module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { browsers: ['> 1%', 'last 2 versions', 'Android >= 5.0', 'Explorer >= 11'] },
        useBuiltIns: 'entry',
      },
    ],
  ],
}
