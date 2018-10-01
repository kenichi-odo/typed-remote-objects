const Webpack = require('webpack')

module.exports = {
  context: `${__dirname}/src`,
  devtool: 'source-map',
  entry: { index: ['./index.ts'] },
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: ['babel-loader', { loader: 'ts-loader', options: { silent: true } }],
        exclude: _ => /node_modules/.test(_) && !/\.js\.ts/.test(_),
      },
    ],
  },
  output: { filename: '[name].js', libraryTarget: 'umd', path: `${__dirname}/lib`, sourceMapFilename: '[file].map' },
  plugins: [new Webpack.DefinePlugin({ 'process.env': { NODE_ENV: JSON.stringify('development') } })],
  resolve: { extensions: ['.ts', '.js'] },
}
