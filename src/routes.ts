import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { FeedPage } from "./components/FeedPage";
import { ProfilePage } from "./components/ProfilePage";
import { MusicMapPage } from "./components/MusicMapPage";
import { PlaylistsPage } from "./components/PlaylistsPage";

export const router = createBrowserRouter([
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