const electron = require('electron')

console.log('electron:', typeof electron)
console.log('electron.app:', typeof electron.app)
console.log('electron.app.whenReady:', typeof electron.app?.whenReady)

if (electron.app) {
  electron.app.whenReady().then(() => {
    console.log('Electron app ready!')
    electron.app.quit()
  })
} else {
  console.error('electron.app is undefined!')
  process.exit(1)
}
