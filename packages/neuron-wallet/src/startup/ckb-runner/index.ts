import { app as electronApp, remote } from 'electron'
import path from 'path'
import { ChildProcess, spawn } from 'child_process'
import logger from 'utils/logger'

const platform = (): string => {
  switch (process.platform) {
    case 'win32':
      return 'win'
    case 'linux':
      return 'linux'
    case 'darwin':
      return 'mac'
    default:
      return ''
  }
}

const app = electronApp || remote.app
let ckb: ChildProcess | null = null

const ckbPath = (): string => {
  return app.isPackaged ?
    path.join(path.dirname(app.getAppPath()), '..', './bin') :
    path.join(__dirname, '../../../bin',)
}

const ckbBinary = (): string => {
  const binary = app.isPackaged ?
    path.resolve(ckbPath(), './ckb') :
    path.resolve(ckbPath(), `./${platform()}`, './ckb')
  return platform() === 'win' ? binary + '.exe' : binary
}

const ckbDataPath = (): string => {
  return path.resolve(app.getPath('userData',), 'chains/mainnet')
}

const initCkb = async () => {
  logger.info('Initializing CKB...')
  return new Promise(resolve => {
    const initCmd = spawn(ckbBinary(), ['init', '--chain', 'mainnet', '-C', ckbDataPath()])
    initCmd.stderr.on('data', data => {
      logger.error('CKB init fail:', data.toString())
    })
    initCmd.stdout.on('data', data => {
      logger.log('CKB init result:', data.toString())
    })

    initCmd.on('close', () => {
      // `ckb init` always quits no matter it fails (usually due to config file already existing) or not.
      resolve()
    })
  })
}

export const startCkbNode = async () => {
  initCkb().finally(() => {
    logger.info('Starting CKB...')
    ckb = spawn(ckbBinary(), ['run', '-C', ckbDataPath()])
    ckb.stderr && ckb.stderr.on('data', data => {
      logger.error('CKB run fail:', data.toString())
    })
    ckb.stdout && ckb.stdout.on('data', _data => {
      // Do not log here. CKB has its own run.log in data/logs.
      // Note `Address already in use` log when port 8114 is used (CKB is already running) outputs also goes here.
    })
    ckb.on('close', () => {
      logger.info('CKB process closed.')
      ckb = null
    })
  })
}

export const stopCkbNode = () => {
  if (ckb) {
    logger.info('Killing CKB')
    ckb.kill()
    ckb = null
  }
}
