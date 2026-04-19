
  # Social Music Discovery Platform

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server. By default the app opens to `/`.


  Spotify setup / To Do

  - Add Spotify client id to `.env` file

  - Register the redirect URI in your Spotify Developer Dashboard. If you use the root path, register e.g. `http://localhost:3000/`. If you use a callback path, register that path exactly (for example `http://localhost:3000/callback`).

  - Finish out endpoint / etc. in api/spotify.ts
  

  Additional packages

  Run `npm install @spotify/web-api-ts-sdk` to install Spotify packages for the API.

  Run `npm install -D @types/react @types/react-dom` for React types (recommended for TypeScript projects).
  Run `npm run dev` to start the development server.
  
  Run `npm install @spotify/web-api-ts-sdk` to install Spotify packages for the API.

  Run `npm install -D @types/react @types/react-dom` for React types (recommended for TypeScript projects).

  Run `npm install @supabase/supabase-js` for supabase dependencies
