import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { FeedPage } from "./components/FeedPage";
import { ProfilePage } from "./components/ProfilePage";
import { MusicMapPage } from "./components/MusicMapPage";
import { PlaylistsPage } from "./components/PlaylistsPage";
import { LoginPage } from "./components/LoginPage";
import { CallbackPage } from "./components/CallbackPage";

export const router = createBrowserRouter([
  { path: "/login",    Component: LoginPage },
  { path: "/callback", Component: CallbackPage },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: FeedPage },
      { path: "profile/:username", Component: ProfilePage },
      { path: "explore", Component: MusicMapPage },
      { path: "playlists", Component: PlaylistsPage },
    ],
  },
]);