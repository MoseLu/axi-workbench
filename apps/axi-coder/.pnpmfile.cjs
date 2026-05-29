const ROLLUP_WASM = "npm:@rollup/wasm-node@4.60.4";

function rewriteRollupDependency(dependencies) {
  if (dependencies && dependencies.rollup) {
    dependencies.rollup = ROLLUP_WASM;
  }
}

module.exports = {
  hooks: {
    readPackage(pkg) {
      rewriteRollupDependency(pkg.dependencies);
      rewriteRollupDependency(pkg.devDependencies);
      rewriteRollupDependency(pkg.optionalDependencies);
      return pkg;
    },
  },
};
