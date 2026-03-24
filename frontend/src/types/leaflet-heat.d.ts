declare module 'leaflet.heat' {
  import * as L from 'leaflet'
  function heatLayer(latlngs: [number, number, number?][], options?: object): L.Layer
  export = heatLayer
}
