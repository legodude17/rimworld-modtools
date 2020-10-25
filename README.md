# rimworld-modtools
> A helper tool to help with developing RimWorld mods

## Install

`npm i -g rimworld-modtools`

## Quick setup

Run `modtools configure -iag` once installed, answer the questions, then select only the keys `mods`, `rwconfig`, and `rwpath`.

When starting a new project or adding this, run `modtools configure -ia`, answer the questions then select the keys `folders` and `csharp`.

Make sure to install and enable the DevHelper, Harmony, and HugsLib RimWorld mods.

From then on, run `modtools run` whenever you want to test your project. If you do not have DevHelper, use `modtools run --logserver=false`, if you don't have HugsLib, you may want to use `modtools run -q`.

## Usage

`modtools <command> [...options]`

### Commands

#### `configure`

Start the configuration wizard. It will ask a few questions (if you let it), then write your config to the config file.

##### Options

###### `-i` or `--interactive`

Enable or disable interactive mode, where it will ask questions for you during execution. Default is on.

###### `-g` or `--global`

Use global configuration? Default is off. If off, then it will use local configuration (which is specified by `--config`).

###### `-a` or `--auto`

Automatically attempt to determine the paths? Default is on. Currently only works on Mac, since that's the only one where I know all the paths.

###### `-k` or `--keys`

Which keys to change in the config file. Default is all. If in interactive mode, you will also be asked to choose these.

###### `-y` or `--yes`

Overwrite config without echoing it back to you and asking for confirmation? Default is no.

#### `build`

Copy folders dictated by `--folders` to the RimWorld mods folder (dictated by `--mods`).

#### `run`

Run `build`, then run the RimWorld executable.

##### Options

###### `-q` or `--quicktest`

Pass the `-quicktest` option to RimWorld? This will automatically generate a default world for you to test in. Default is off. I recommend install the HugsLib RimWorld mod and using its quickstart options instead.

###### `--logserver`

Start a server for RimWorld to log to? Only enable if you have the DevHelper mod installed and enabled. I highly recommend it. Default is on.

When using this option and DevHelper, it will automatically change the DevHelper config to enable the remote logging to its server. DevHelper also suppresses messages in the game's debug log, so they will only by shown in this program. This does some neat formatting, so it's worth a try, right?

###### `--port`

Port to host the log server on. Does nothing if `--logserver` is set to off. Default is 8888.

#### Global Options

##### `-h` or `--help`

Output help text. Very similar to this document, it is.

##### `-v` or `--version`

Output version. I recommend checking occasionally for new updates.

##### `-c` or `--config`

Path to local config file to use. Must end in `.json` and file must be JSON. Default is `.modtools.json`. Try out `modtools configure` without `-g` to create one "automatically".

##### `--rwpath`

Path to RimWorld executable. Must be absolute. I recommend running `modtools configure -iag` to make a global configuration file with autodetected paths.

##### `--rwconfig`

Path to RimWorld config folder. Only needed if you are using the log server. Must be absolute. I recommend running `modtools configure -iag` to make a global configuration file with autodetected paths.

##### `--mods`

Path to RimWorld mods folder. Very much required. Must be absolute. I recommend running `modtools configure -iag` to make a global configuration file with autodetected paths.

##### `--folder`

Which folders to include. Defaults to `['Defs', 'Patches', 'About', 'Sounds', 'Textures']`, with `'Assemblies'` if `--csharp` is on.

##### `--csharp`

Use csharp? This really only controls if `'Assemblies'` is added to the default folder list. Default is on.

##### `--cwd`

Directory to work in. Defaults to the directory you are currently working in. Shouldn't really be needed.

#### Configuration

Configuration will be loaded from the `~/.rwmodtools.json`, `.modtools.json` in the cwd, and from the command line. Command line overrides the files, but I don't recommend duplicating options between the files.
