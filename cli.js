#! /usr/bin/env node

/* eslint-disable no-console */

const enquirer = require('enquirer');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const ll = require('listr-log');
const {
  promises: fs, constants: CONSTANTS, readFileSync, accessSync
} = require('fs');
const path = require('path');
const tools = require('.');

const { HOME } = process.env;

function home([...ps]) {
  return path.join(HOME, ...ps);
}

const GLOABLCONFIGFILE = home`.rwmodtools.json`;

const RWBYPLATFORM = {
  darwin: {
    executable: [
      home`Library/Application Support/Steam/steamapps/common/RimWorld/RimWorldMac.app/Contents/MacOS/RimWorld By Ludeon Studios`
    ],
    config: [
      home`Library/Application Support/RimWorld/Config`
    ],
    mods: [
      home`Library/Application Support/Steam/steamapps/common/RimWorld/RimWorldMac.app/Mods`
    ]
  }
};

async function exists(p) {
  let exists;
  // eslint-disable-next-line no-bitwise
  try { await fs.access(p, CONSTANTS.W_OK | CONSTANTS.R_OK); exists = true; } catch (e) {
    if (e.errno === -2) exists = false; else console.error(e);
  }
  return exists;
}

function existsSync(p) {
  let exists;
  // eslint-disable-next-line no-bitwise
  try { accessSync(p, CONSTANTS.W_OK | CONSTANTS.R_OK); exists = true; } catch (e) {
    if (e.errno === -2) exists = false; else console.error(e);
  }
  return exists;
}

// eslint-disable-next-line no-bitwise
async function check(p, mode = CONSTANTS.W_OK | CONSTANTS.R_OK) {
  await fs.access(p, mode);
  return p;
}

let globalConfig;

try { globalConfig = JSON.parse(readFileSync(GLOABLCONFIGFILE, 'utf8')); } catch (e) {
  if (e.errno === -2) globalConfig = {}; else console.error(e);
}

const arger = yargs(hideBin(process.argv))
  .command('build', 'copy all the relevant files to the rimworld mod folder')
  .command('configure', 'configure the tool', {
    global: {
      alias: 'g',
      default: false,
      type: 'boolean',
      describe: 'run global configuration?'
    },
    interactive: {
      alias: 'i',
      default: true,
      type: 'boolean',
      describe: 'run in interactive mode?'
    },
    auto: {
      alias: 'a',
      default: true,
      type: 'boolean',
      describe: 'attempt to automatically determine paths?'
    },
    keys: {
      alias: 'k',
      default: 'all',
      type: 'array',
      describe: 'which keys to change?'
    },
    yes: {
      alias: 'y',
      default: false,
      type: 'boolean',
      descirbe: 'write without asking first?'
    }
  })
  .command('run', 'copy files, then run rimworld', yargs => yargs.option('quicktest', {
    describe: 'pass -quicktest to RimWorld?',
    default: false,
    type: 'boolean'
  }).alias('quicktest', ['q', 'quick', 'test']))
  .config('config')
  .alias('config', 'c')
  .describe('config', 'path to configuration folder')
  .default('config', '.modtools.json')
  .epilog(`Additionally, configuraton will be loaded from ${GLOABLCONFIGFILE}`)
  .option('rwpath', {
    describe: 'path to rimworld executable',
    type: 'string'
  })
  .alias('rwpath', ['rimworldpath', 'rimworld-path', 'path'])
  .option('mods', {
    describe: 'path to rimworld mods folder',
    type: 'string'
  })
  .alias('mods', ['mod-folder', 'folder', 'modfolder'])
  .option('csharp', {
    describe: 'does this project use C#?',
    default: true,
    type: 'boolean'
  })
  .alias('csharp', ['code', 'C#'])
  .option('folders', {
    describe: 'override the default folders with your own list',
    type: 'array'
  })
  .option('cwd', {
    describe: 'override the cwd to work in a different one',
    type: 'string'
  })
  .option('logserver', {
    describe: 'start a server for DevHelper? (only enable if you have DevHelper installed)',
    type: 'boolean',
    default: true
  })
  .option('rwconfig', {
    describe: 'the folder containing rimworld config',
    type: 'string'
  })
  .option('port', {
    describe: 'port of listen to for the log server',
    type: 'number',
    default: 8888
  })
  .alias('help', 'h')
  .alias('version', 'v')
  .config(globalConfig);

(async function cli(arger) {
  const args = arger.argv;
  const command = args._[0];
  if (!command) {
    console.error('Need a command');
    arger.showHelp('error');
    return;
  }
  if (!['run', 'configure', 'build'].includes(command)) {
    console.error('Invalid command:', command);
    arger.showHelp('error');
  }
  if (command === 'configure') {
    const configFile = args.global ? GLOABLCONFIGFILE : args.config;
    const configPath = path.resolve(configFile);

    let config;
    if (await exists(configPath)) {
      const configContents = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(configContents);
    } else {
      config = {};
    }
    const oldConfig = {};
    Object.assign(oldConfig, config);
    const { defaulted, aliases } = arger.parsed;
    defaulted._ = true;
    defaulted.$0 = true;
    defaulted.y = true;
    defaulted.yes = true;
    defaulted.keys = true;
    defaulted.k = true;
    for (const key of Object.keys(defaulted)) {
      if (aliases[key]) {
        aliases[key].forEach(alias => { defaulted[alias] = true; });
      }
    }
    for (const key of Object.keys(args)) {
      if (!defaulted[key]) config[key] = args[key];
    }
    if (args.auto) {
      if (!args.global) console.error('It is recommended you only use automatic mode on global config');
      ll.start();
      ll.addTask({ title: 'Attempting to find RimWorld folders', name: 'find' });
      const rw = RWBYPLATFORM[process.platform];
      if (!rw) {
        ll.find.error(`No information for platform ${process.platform}`);
      } else {
        if (!config.rwpath) {
          const exec = rw.executable;
          ll.find.addTask({ title: 'Finding RimWorld executable', name: 'exec' });
          let res;
          try {
            res = await Promise.any(exec.map(p => check(p, CONSTANTS.X_OK)));
          } catch (e) { res = null; }
          if (res) {
            config.rwpath = res;
            ll.find.exec.complete(`Found executable at ${path.relative(process.env.HOME, res)}`);
          } else {
            ll.find.exec.error('Failed to find RimWorld executable', false);
          }
        } if (!config.mods) {
          const { mods } = rw;
          ll.find.addTask({ title: 'Finding RimWorld mods folder', name: 'mods' });
          let res;
          try {
            res = await Promise.any(mods.map(p => check(p)));
          } catch (e) { res = null; }
          if (res) {
            config.mods = res;
            ll.find.mods.complete(`Found mods folder at ${path.relative(process.env.HOME, res)}`);
          } else {
            ll.find.mods.error('Failed to find RimWorld mods folder', false);
          }
        } if (!config.rwconfig) {
          const rwconfig = rw.config;
          ll.find.addTask({ title: 'Finding RimWorld config folder', name: 'config' });
          let res;
          try {
            res = await Promise.any(rwconfig.map(p => check(p)));
          } catch (e) { res = null; }
          if (res) {
            config.rwconfig = res;
            ll.find.config.complete(`Found config folder at ${path.relative(process.env.HOME, res)}`);
          } else {
            ll.find.config.error('Failed to find RimWorld config folder', false);
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      ll.end();
    }
    if (args.interactive) {
      const defaultFolders = [...(new Set([
        'Defs',
        'Patches',
        'About',
        'Sounds',
        'Textures'
      ].concat(config.folders || [])))];
      if (args.csharp && !defaultFolders.includes('Assemblies')) {
        defaultFolders.push('Assemblies');
      }
      const existingFolders = defaultFolders
        .filter(p => existsSync(
          path.resolve(args.cwd || process.cwd(),
            p)
        )).concat(config.folders || []);
      const questions = [
        {
          name: 'rwpath',
          type: 'input',
          message: 'Enter the path to the RimWorld executable',
          initial: config.rwpath
        },
        {
          name: 'mods',
          type: 'input',
          message: 'Enter the path to the RimWorld mods folder',
          initial: config.mods
        },
        {
          name: 'rwconfig',
          type: 'input',
          message: 'Enter the path to the RimWorld config folder',
          initial: config.rwconfig
        },
        {
          name: 'csharp',
          type: 'confirm',
          message: 'Does your project use C#?',
          initial: (config.csharp == null) ? true : config.csharp
        },
        {
          name: 'folders',
          type: 'multiselect',
          message: 'Which folders to include?',
          choices: defaultFolders,
          initial: existingFolders
        }
      ];
      const answers = await enquirer.prompt(questions);
      for (const key of Object.keys(answers)) {
        config[key] = answers[key];
      }
    }
    let keysToChange = Object.keys(config);
    if (args.keys.length > 1 || args.keys[0] !== 'all') {
      keysToChange = args.keysToChange;
    }
    if (args.interactive) {
      ({ keysToChange } = await enquirer.prompt({
        name: 'keysToChange',
        type: 'multiselect',
        choices: Object.keys(config),
        initial: keysToChange,
        message: `Which keys should we update in ${configFile}?`
      }));
    }
    for (const key of Object.keys(config)) {
      if (!keysToChange.includes(key)) config[key] = oldConfig[key];
    }
    console.error(`To be written to ${configFile}:`);
    console.error(JSON.stringify(config, null, 2));
    const yes = args.yes || (await enquirer.prompt({
      type: 'confirm',
      message: 'Write?',
      initial: true,
      name: 'yes'
    })).yes;
    if (yes) {
      ll.start();
      ll.addTask({ title: 'Write to config file', name: 'write' });
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      ll.write.complete(`Wrote to ${configFile}`);
    } else {
      console.log('Aborted');
    }
  }
  args.ll = ll;
  if (command === 'build' || command === 'run') {
    await tools.copy(args);
  }
  if (command === 'run') {
    await tools.run(args);
  }
  await new Promise(resolve => setTimeout(resolve, 500));
}(arger))
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
