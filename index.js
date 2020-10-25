const path = require('path');
const { promises: fs } = require('fs');
const net = require('net');
const figures = require('figures');
const { Parser, Builder } = require('xml2js');
const execa = require('execa');
const chalk = require('chalk');
const width = require('string-width');
const size = require('term-size');
const { DateTime } = require('luxon');

const LEVELSTOSYMBOLS = {
  ERROR: chalk.red(figures.cross),
  WARN: chalk.yellow(figures.warning),
  ASSERT: chalk.cyan('='),
  LOG: chalk.blue(figures.info),
  EXCEPTION: chalk.red(figures.cross)
};

module.exports = {
  async copy({
    mods, csharp, folders, cwd = process.cwd(), ll
  } = {}) {
    if (folders == null) {
      folders = [
        'Defs',
        'Patches',
        'About',
        'Sounds',
        'Textures'
      ];
      if (csharp) folders.push('Assemblies');
    }
    cwd = path.resolve(process.cwd(), cwd);
    mods = path.resolve(cwd, mods);
    const modFolderName = path.basename(cwd);
    const modFolder = path.join(mods, modFolderName);
    try {
      const stat = await fs.stat(modFolder);
      if (!stat.isDirectory()) {
        console.error('Mod folder not a directory, deleting then recreating');
        await fs.rm(modFolder);
        await fs.mkdir(modFolder);
      }
    } catch (e) {
      if (e.errno === -2) {
        console.error('Mod folder not found, creating');
        await fs.mkdir(modFolder);
      }
    }
    function relativeSource(p) {
      return path.relative(cwd, p);
    }
    function relativeDest(p) {
      return path.relative(modFolder, p);
    }
    async function copyFolder(source, dest, ll) {
      if (ll) ll.addTask({ name: source, title: `Copying folder ${relativeSource(source)}` });
      let tl;
      if (ll) tl = ll[source];
      let stat;
      try { stat = await fs.stat(source); } catch (e) {
        if (e.errno === -2) {
          if (tl) tl.error(`Folder ${relativeSource(source)} does not exist, skipping`);
          return;
        }
      }
      if (!stat.isDirectory()) {
        if (tl) tl.failure(`ERROR: Not a directory: ${relativeSource(source)}`);
        return;
      }
      try {
        await fs.stat(dest);
      } catch (e) {
        if (tl) tl.info(`Creating ${relativeDest(dest)}`);
        await fs.mkdir(dest);
        if (tl) tl.debug(`Created ${relativeDest(dest)}`);
      }
      const contents = await fs.readdir(source);
      for (const file of contents) {
        const fileSource = path.join(source, file);
        const fileDest = path.join(dest, file);
        let fileStat;
        // eslint-disable-next-line no-await-in-loop
        try { fileStat = await fs.stat(fileSource); } catch (e) {
          if (e.errno === -2) {
            if (tl) tl.error(`ERROR: ${relativeSource(fileSource)} does not exist, skipping`);
            // eslint-disable-next-line no-continue
            continue;
          }
        }
        if (fileStat.isFile()) {
          if (tl) tl.addTask({ title: `${relativeSource(fileSource)} -> ${relativeDest(fileDest)}`, name: fileSource });
          // eslint-disable-next-line no-await-in-loop
          await fs.copyFile(fileSource, fileDest);
          if (tl) tl[fileSource].complete(`Wrote ${relativeDest(fileDest)}`);
        } else if (fileStat.isDirectory()) {
          if (tl) tl.info(`Found inner folder ${relativeSource(fileSource)}, entering`);
          // eslint-disable-next-line no-await-in-loop
          await copyFolder(fileSource, fileDest, tl);
          if (tl) tl.debug(`Done with inner folder ${relativeSource(fileSource)}`);
        } else if (tl) {
          tl.warning(`Found symlink or something at ${relativeSource(fileSource)}, skipping`);
        }
      }
      if (tl) tl.complete(`Finished folder ${relativeSource(source)}`);
    }
    ll.start();
    for (const folder of folders) {
      // eslint-disable-next-line no-await-in-loop
      await copyFolder(path.join(cwd, folder), path.join(modFolder, folder), ll);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  },
  async run({
    rwpath, logserver, rwconfig, ll, port, stream, cwd = process.cwd(), quicktest
  } = {}) {
    if (ll) ll.start();
    if (logserver) {
      if (ll) ll.addTask({ name: 'server', title: 'Creating log server' });
      const server = net.createServer(socket => {
        stream.write(`${figures.play} Recived connection\n`);
        socket.on('data', data => {
          data = data.toString();
          const line = data.split('\n')[0];
          const parts = line.split(' ');
          let time;
          let figure;
          let message;
          if (parts.length >= 3) {
            [time] = parts;
            figure = LEVELSTOSYMBOLS[parts[1]];
            message = parts.slice(2).join(' ').trim();
          } else if (parts.length === 2) {
            [time] = parts;
            figure = LEVELSTOSYMBOLS.EXCEPTION;
            message = parts.slice(1).join(' ').trim();
          } else {
            time = '';
            figure = '';
            message = parts.join(' ');
          }
          time = DateTime.fromFormat(time, 'yyyyMMddHHmmss.SSS');
          time = time.toLocaleString(DateTime.TIME_WITH_SECONDS);
          const spacing = size().columns - (width(figure) + width(message) + 3 + width(time));
          if (spacing <= 0) {
            stream.write(`${figure} ${message}`);
          } else {
            stream.write(`${figure} ${message}${' '.repeat(spacing)}${chalk.dim(`[${time}]`)}`);
          }
          stream.write(data
            .split('\n')
            .slice(1)
            .filter(Boolean)
            .map(str => `${' '.repeat(width(figure))}${str}\n`)
            .join(''));
        });
        socket.on('end', () => {
          stream.write(`${figures.warning} Connection finished\n`);
        });
      });
      server.listen(port, () => {
        if (ll) ll.server.complete(`Server bound to localhost:${port}`);
      });
      if (ll) ll.addTask({ name: 'config', title: 'Changing DevHelper config' });
      if (ll) ll.config.addTask({ name: 'find', title: 'Attempting to find DevHelper config' });
      const configDir = path.resolve(cwd, rwconfig);
      const dir = await fs.readdir(configDir);
      let configFile;
      for (const file of dir) {
        if (ll) ll.config.find.debug(`Checking ${file}`);
        if (file.includes('DevHelper')) {
          configFile = path.join(configDir, file);
          break;
        }
      }
      if (configFile) {
        if (ll) ll.config.find.complete(`Found DevHelper config at ${path.relative(configDir, configFile)}`);
        if (ll) ll.config.addTask({ name: 'read', title: 'Reading DevHelper config' });
        const configText = await fs.readFile(configFile, { encoding: 'utf8' });
        if (ll) ll.config.read.complete('Read config xml');
        if (ll) ll.config.addTask({ name: 'parse', title: 'Parsing and changing DevHelper config' });
        const obj = await (new Parser().parseStringPromise(configText));
        obj.SettingsBlock.ModSettings[0].remoteLoggingEnabled = true;
        obj.SettingsBlock.ModSettings[0].remoteLoggingHostname = 'localhost';
        obj.SettingsBlock.ModSettings[0].remoteLoggingPort = port;
        const newText = new Builder().buildObject(obj);
        if (ll) ll.config.parse.complete('Parsed and generated');
        if (ll) ll.config.addTask({ name: 'write', title: 'Writing to DevHelper config' });
        await fs.writeFile(configFile, newText);
        if (ll) ll.config.write.complete('Wrote new config xml');
        if (ll) ll.config.complete('Rewrote DevHelper comfig to use our server');
      } else {
        if (ll) ll.config.find.error(`Could not find DevHelper config (checked ${dir.length} files)`);
        server.close();
      }
    }
    if (ll) ll.addTask({ name: 'run', title: 'Launch RimWorld' });
    const proc = execa(rwpath, quicktest ? ['-quicktest'] : [], { cwd, all: true });
    proc.all.on('data', data => {
      if (data.includes('SteamAPI_Init() failed') && ll) ll.run.info('RimWorld failed to find steam API');
      if (data.includes('Using device') && ll) {
        ll.run.complete('RimWorld launched successfully');
        ll.end();
      }
    });
    process.on('exit', () => {
      if (proc.exitCode != null) return;
      stream.write(`${figures.warning} Process terminated, terminating RimWorld`);
      proc.cancel();
    });
    await proc;
    stream.write(`${figures.tick} RimWorld process completed`);
  }
};
