import { router, type Href } from "expo-router";

// "Back" should return to the screen the user came from. When there is no
// history to pop — a deep link, a reload, or a screen opened as the first one —
// falling back to the wallet home is wrong: it drops the person somewhere they
// never were. Each caller names the screen that logically sits behind it.
export function goBack(fallback: Href) {
  if (router.canGoBack()) {
    router.back();

    return;
  }

  router.replace(fallback);
}
