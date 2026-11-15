/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "f188f126d0db2cebd06b2eda9510aff8"
  }, {
    "url": "pwa-512x512.png",
    "revision": "9d4b1b1d04b3bae178acbdf6cf40083f"
  }, {
    "url": "pwa-192x192.png",
    "revision": "8a431aaee0493deca3a8e44660aa5fe8"
  }, {
    "url": "index.html",
    "revision": "7b3f948cba24c1deb33ab9ddfb4b5cf3"
  }, {
    "url": "icon.svg",
    "revision": "c6016d9974576901c2fcb0476a7f8f53"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "1d89a9a3903e73577ec555b29607909a"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/web-mdwzXyAu.js",
    "revision": null
  }, {
    "url": "assets/web-YOiyqh-_.js",
    "revision": null
  }, {
    "url": "assets/web-EDqmaThr.js",
    "revision": null
  }, {
    "url": "assets/web-DqLB_b7V.js",
    "revision": null
  }, {
    "url": "assets/web-DTL_FDns.js",
    "revision": null
  }, {
    "url": "assets/web-CJYpoeYn.js",
    "revision": null
  }, {
    "url": "assets/web-C3wbRqkD.js",
    "revision": null
  }, {
    "url": "assets/purify.es-Dzkdzyfv.js",
    "revision": null
  }, {
    "url": "assets/index.es-Cd2E6k1p.js",
    "revision": null
  }, {
    "url": "assets/index-Q84s-0aO.css",
    "revision": null
  }, {
    "url": "assets/index-CA4mmfIj.js",
    "revision": null
  }, {
    "url": "assets/html2canvas-B6Rul4gx.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "1d89a9a3903e73577ec555b29607909a"
  }, {
    "url": "icon.svg",
    "revision": "c6016d9974576901c2fcb0476a7f8f53"
  }, {
    "url": "pwa-192x192.png",
    "revision": "8a431aaee0493deca3a8e44660aa5fe8"
  }, {
    "url": "pwa-512x512.png",
    "revision": "9d4b1b1d04b3bae178acbdf6cf40083f"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "f188f126d0db2cebd06b2eda9510aff8"
  }, {
    "url": "manifest.webmanifest",
    "revision": "f316dad430f6154950227971789d1cc7"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
