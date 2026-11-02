Self-hosted three.js r128 (MIT, see LICENSE) so no page depends on a third-party CDN
(faster in regions where public CDNs are throttled, and a tighter Content-Security-Policy).

- `three.min.js` — `three@0.128.0/build/three.min.js` from npm, unmodified.
- The other files are unmodified copies of `three@0.128.0/examples/js/{shaders,postprocessing}/*.js`,
  kept in one flat folder.
