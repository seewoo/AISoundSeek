const png2icons = require('png2icons')
const fs = require('fs')

const input = fs.readFileSync('assets/source.png')

fs.writeFileSync('assets/icon.ico', png2icons.createICO(input, png2icons.BICUBIC, 0, true))
fs.writeFileSync('assets/icon.icns', png2icons.createICNS(input, png2icons.BICUBIC, 0))
// Linux 直接用原 PNG
fs.copyFileSync('assets/source.png', 'assets/icon.png')