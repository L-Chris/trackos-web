import AMapLoader from '@amap/amap-jsapi-loader';

let loaderPromise: Promise<any> | null = null;

export function loadAmap() {
  const key = import.meta.env.VITE_AMAP_KEY;

  if (!key) {
    return Promise.reject(new Error('缺少 VITE_AMAP_KEY，无法加载高德地图。'));
  }

  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;
  if (securityJsCode) {
    window._AMapSecurityConfig = {
      securityJsCode,
    };
  }

  if (!loaderPromise) {
    loaderPromise = AMapLoader.load({
      key,
      version: '2.0',
      plugins: ['AMap.Scale', 'AMap.ToolBar'],
    });
  }

  return loaderPromise;
}