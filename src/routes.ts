import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { FeedPage } from "./components/FeedPage";
import { ProfilePage } from "./components/ProfilePage";
import { MusicMapPage } from "./components/MusicMapPage";
import { PlaylistsPage } from "./components/PlaylistsPage";
import { LoginPage } from "./components/LoginPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: FeedPage },
        { path: "login", Component: LoginPage },
      { path: "profile/:username", Component: ProfilePage },
      { path: "explore", Component: MusicMapPage },
      { path: "playlists", Component: PlaylistsPage },
    ],
  },
]);