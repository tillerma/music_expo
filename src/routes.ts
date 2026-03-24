import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { FeedPage } from "./components/FeedPage";
import { ProfilePage } from "./components/ProfilePage";
import { MusicMapPageV2 } from "./components/MusicMapPageV2";
import { PlaylistsPage } from "./components/PlaylistsPage";
import { LoginPage } from "./components/LoginPage";
import { CreateAccountPage } from "./components/CreateAccountPage";

export const router = createBrowserRouter([
  { path: "/login",    Component: LoginPage },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: FeedPage },
        { path: "login", Component: LoginPage },
        { path: "create-account", Component: CreateAccountPage },
      { path: "profile/:username", Component: ProfilePage },
      { path: "explore", Component: MusicMapPageV2 },
      { path: "playlists", Component: PlaylistsPage },
    ],
  },
]);