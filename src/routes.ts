import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { FeedPage } from "./components/FeedPage";
import { ProfilePage } from "./components/ProfilePage";
import { ExplorePage } from "./components/ExplorePage";
import { PlaylistsPage } from "./components/PlaylistsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: FeedPage },
      { path: "profile/:username", Component: ProfilePage },
      { path: "explore", Component: ExplorePage },
      { path: "playlists", Component: PlaylistsPage },
    ],
  },
]);
