# MY PRESENCE

Premium Electron desktop application for designing and managing Discord Rich Presence profiles with a polished React + TypeScript interface.

## Features

- **Rich Presence Editor** - Design custom Discord presence with live preview
- **Profile Management** - Create, duplicate, favorite, delete, and search profiles
- **Custom Themes** - Background customization with video, image, gradient, and solid color support
- **Asset Library** - Manage and upload custom images for Discord presence
- **Discord RPC Integration** - Direct connection to Discord with real-time status updates
- **Persistent Storage** - LocalStorage-based persistence for profiles, themes, and settings
- **Tray Mode** - Minimize to system tray with quick actions menu
- **Auto-Launch** - Optional startup on system boot with hidden launch
- **Onboarding Wizard** - First-run experience to guide new users
- **Theme System** - Customizable UI themes with glass effects and overlays
- **Timestamp Modes** - Multiple timestamp options including elapsed, countdown, and static times
- **Button Support** - Add up to 2 clickable buttons with custom labels and URLs
- **Activity Types** - Support for Playing, Listening, Watching, and Competing activities
- **Video Backgrounds** - Upload and use custom video backgrounds
- **Theme Import/Export** - Share themes with JSON import/export

## Getting started

1. Install dependencies with `npm install`
2. Configure Discord Application ID in `src/lib/config.ts` (see instructions in file)
3. Start the desktop app with `npm run dev`
4. Create production builds with `npm run build`

## Production builds

- **Development**: `npm run dev` - Runs Vite dev server and Electron
- **Build**: `npm run build` - Builds renderer and Electron main process
- **Package**: `npm run pack` - Creates unpacked distributable in `release/`
- **Distribute**: `npm run dist` - Creates installer (NSIS) for Windows

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Zustand + Framer Motion + GSAP
- **Backend**: Electron 32 with secure IPC bridge
- **Discord RPC**: Custom dependency-free Discord IPC client
- **Persistence**: LocalStorage with automatic state sync
- **Build**: electron-builder for packaging and distribution