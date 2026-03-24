import os, logging, threading, warnings
from pathlib import Path
from typing import Optional
import numpy as np
import torch
import torch.nn as nn
import joblib
from pytorch_tabnet.tab_model import TabNetRegressor
from sklearn.linear_model import Ridge
import uuid
from datetime import datetime, timezone

warnings.filterwarnings('ignore', category=UserWarning)
logger = logging.getLogger(__name__)

# === PYTORCH MODEL CLASSES (exact copy from training notebook) ===

class MLP(nn.Module):
    '''Multi-Layer Perceptron for Kenya land price prediction.
    Architecture: 6 → 128(BN+ReLU+Drop0.3) → 64(BN+ReLU+Drop0.3)
    → 32(BN+ReLU+Drop0.2) → 1
    Input: 6 features (MLP_FEATURES, scaled)
    Output: scalar log_price_per_acre
    '''
    def __init__(self, input_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 128), nn.BatchNorm1d(128),
            nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, 64), nn.BatchNorm1d(64),
            nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(64, 32), nn.BatchNorm1d(32),
            nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(32, 1)
        )
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(1)

class SNN(nn.Module):
    '''Spatial Neural Network with two-branch architecture.
    spatial_branch : [lat, lon] → 32 → 16 → 8  (location embedding)
    feature_branch : [5 feats]  → 64 → 32 → 16 (tabular embedding)
    merger         : concat(8+16=24) → 16 → 8 → 1
    CRITICAL: forward() takes TWO inputs: x_spatial, x_tabular
    '''
    def __init__(self, spatial_dim: int, tabular_dim: int):
        super().__init__()
        self.spatial_branch = nn.Sequential(
            nn.Linear(spatial_dim, 32), nn.ReLU(),
            nn.Dropout(0.2), nn.Linear(32, 16),
            nn.ReLU(), nn.Linear(16, 8), nn.ReLU(),
        )
        self.feature_branch = nn.Sequential(
            nn.Linear(tabular_dim, 64), nn.BatchNorm1d(64),
            nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(64, 32), nn.ReLU(),
            nn.Dropout(0.2), nn.Linear(32, 16), nn.ReLU(),
        )
        self.merger = nn.Sequential(
            nn.Linear(24, 16), nn.ReLU(),
            nn.Dropout(0.2), nn.Linear(16, 8),
            nn.ReLU(), nn.Linear(8, 1)
        )
        
    def forward(self, x_spatial: torch.Tensor, x_tabular: torch.Tensor) -> torch.Tensor:
        return self.merger(torch.cat([
            self.spatial_branch(x_spatial),
            self.feature_branch(x_tabular)
        ], dim=1)).squeeze(1)

# === FEATURE CONSTANTS ===
MLP_FEATURES = [
    'amenities_score', 'accessibility_score', 'infrastructure_score',
    'log_size_acres', 'dist_to_nairobi_km', 'geocode_confidence'
]
SNN_SPATIAL_FEATURES = ['latitude', 'longitude']
SNN_TABULAR_FEATURES = [
    'amenities_score', 'accessibility_score', 'infrastructure_score',
    'log_size_acres', 'dist_to_nairobi_km'
]
TABNET_FEATURES = MLP_FEATURES + ['latitude', 'longitude']

# === EnsembleService CLASS ===
class EnsembleService:
    '''Thread-safe singleton. Models loaded once at startup.'''
    _instance: Optional['EnsembleService'] = None
    _lock = threading.Lock()

    def __new__(cls) -> 'EnsembleService':
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self._loaded = False
            self._shap_explainer = None
            self._shap_lock = threading.Lock()
            self._initialized = True

    def load_models(self, model_dir: str) -> None:
        '''Load all models and scalers from model_dir.
        Raises FileNotFoundError if any required file is missing.
        Logs loaded model sizes and meta-learner weights.
        '''
        if self._loaded:
            logger.info('EnsembleService already loaded — skipping')
            return
            
        p = Path(model_dir)
        required = [
            'mlp_model.pt', 'snn_model.pt', 'tabnet_model.zip',
            'meta_learner.pkl', 'mlp_scaler.pkl',
            'snn_sp_scaler.pkl', 'snn_tab_scaler.pkl', 'tab_scaler.pkl'
        ]
        
        for f in required:
            if not (p / f).exists():
                raise FileNotFoundError(f'Missing model file: {p / f}')

        # Load PyTorch models
        self.mlp_model = MLP(input_dim=6).to(self.device)
        self.mlp_model.load_state_dict(
            torch.load(p / 'mlp_model.pt', map_location=self.device, weights_only=True)
        )
        self.mlp_model.eval()

        self.snn_model = SNN(spatial_dim=2, tabular_dim=5).to(self.device)
        self.snn_model.load_state_dict(
            torch.load(p / 'snn_model.pt', map_location=self.device, weights_only=True)
        )
        self.snn_model.eval()

        # Load TabNet (its own format)
        self.tabnet_model = TabNetRegressor()
        self.tabnet_model.load_model(str(p / 'tabnet_model.zip'))

        # Load scikit-learn objects
        self.meta_learner = joblib.load(p / 'meta_learner.pkl')
        self.mlp_scaler = joblib.load(p / 'mlp_scaler.pkl')
        self.snn_sp_scaler = joblib.load(p / 'snn_sp_scaler.pkl')
        self.snn_tab_scaler = joblib.load(p / 'snn_tab_scaler.pkl')
        self.tab_scaler = joblib.load(p / 'tab_scaler.pkl')

        self._loaded = True

        coef = self.meta_learner.coef_
        logger.info(f'EnsembleService loaded. Meta weights: MLP={coef[0]:.4f} SNN={coef[1]:.4f} TabNet={coef[2]:.4f}')

    @property
    def is_loaded(self) -> bool:
        return getattr(self, '_loaded', False)

    def get_model_versions(self) -> dict[str, str]:
        return {
            'MLP': '1.0.0-pytorch',
            'SNN': '1.0.0-pytorch',
            'TabNet': '1.0.0-tabnet',
            'MetaLearner': '1.0.0-ridge'
        }
    
    def predict(self, req_data: dict) -> dict:
        """
        Executes the 4-model ensemble pipeline.
        req_data: Dictionary of validated features from PredictionRequest.
        """
        if not self.is_loaded:
            raise RuntimeError("Models not loaded. Call load_models() first.")
        
        if req_data.get("dist_to_nairobi_km") is None:
            raise ValueError(
                "dist_to_nairobi_km is required for inference. "
                "It should be injected by geo_service before calling predict()."
            )
            
        try:
            # 1. Shape Arrays (Strict ordering based on feature lists)
            mlp_arr = np.array([[req_data[k] for k in MLP_FEATURES]])
            snn_sp_arr = np.array([[req_data[k] for k in SNN_SPATIAL_FEATURES]])
            snn_tab_arr = np.array([[req_data[k] for k in SNN_TABULAR_FEATURES]])
            tab_arr = np.array([[req_data[k] for k in TABNET_FEATURES]])
            
            # 2. Scale
            mlp_scaled = self.mlp_scaler.transform(mlp_arr)
            snn_sp_scaled = self.snn_sp_scaler.transform(snn_sp_arr)
            snn_tab_scaled = self.snn_tab_scaler.transform(snn_tab_arr)
            tab_scaled = self.tab_scaler.transform(tab_arr)
            
            # 3. Convert to PyTorch Tensors
            mlp_t = torch.tensor(mlp_scaled, dtype=torch.float32).to(self.device)
            snn_sp_t = torch.tensor(snn_sp_scaled, dtype=torch.float32).to(self.device)
            snn_tab_t = torch.tensor(snn_tab_scaled, dtype=torch.float32).to(self.device)
            
            # 4. Base Model Inference (eval mode, no grad tracking)
            with torch.no_grad():
                mlp_log = float(self.mlp_model(mlp_t).cpu().item())
                snn_log = float(self.snn_model(snn_sp_t, snn_tab_t).cpu().item())
            
            # TabNet requires float32 numpy array
            tabnet_log = float(self.tabnet_model.predict(tab_scaled.astype(np.float32))[0][0])
            
            # 5. Meta-Learner Inference
            meta_input = np.array([[mlp_log, snn_log, tabnet_log]])
            final_log = float(self.meta_learner.predict(meta_input)[0])
            
            # 6. Convert Log Prices back to KSH (expm1 is the inverse of log1p)
            # Clip prevents inf/overflow before expm1
            final_log_clipped = float(np.clip(final_log, -2.0, 22.0))
            final_price_per_acre = float(np.expm1(final_log_clipped))
            total_price = final_price_per_acre * req_data['size_acres']
            
            # 7. Calculate Confidence (Heuristic based on base model variance)
            preds = np.array([mlp_log, snn_log, tabnet_log])
            std_dev = float(np.std(preds))
            confidence = max(0.0, min(1.0, 1.0 - (std_dev / 2.0)))
            label = "High" if confidence >= 0.8 else "Medium" if confidence >= 0.5 else "Low"
            
            # 8. Construct Response Dictionary
            meta_w = self.meta_learner.coef_

            return {
                "prediction_id": str(uuid.uuid4()),
                "county": req_data.get('county') or 'Unknown',
                "ensemble_log_pred": final_log,
                "price_per_acre_ksh": final_price_per_acre,
                "total_price_ksh": total_price,
                "model_breakdown": [
                   {"model_name": "MLP",    "log_pred": mlp_log,    "price_per_acre_ksh": float(np.expm1(np.clip(mlp_log,    -2.0, 22.0)))},
                    {"model_name": "SNN",    "log_pred": snn_log,    "price_per_acre_ksh": float(np.expm1(np.clip(snn_log,    -2.0, 22.0)))},
                    {"model_name": "TabNet", "log_pred": tabnet_log, "price_per_acre_ksh": float(np.expm1(np.clip(tabnet_log, -2.0, 22.0)))},
                ],
                "meta_weights": {"MLP": float(meta_w[0]), "SNN": float(meta_w[1]), "TabNet": float(meta_w[2])},
                "input_features": {k: req_data[k] for k in TABNET_FEATURES},
                "log_size_acres_used": req_data['log_size_acres'],
                "confidence_score": confidence,
                "confidence_label": label,
                "model_versions": self.get_model_versions(),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Inference failed: {str(e)}")
            raise RuntimeError(f"Prediction Engine Error: {str(e)}")