// Toolbar button + Alt+Shift+Y: toggle calm mode on YouTube, or open it.
const ext = browser;

ext.browserAction.onClicked.addListener(async (tab) => {
  try {
    await ext.tabs.sendMessage(tab.id, { type: 'calmyt:toolbar' });
  } catch {
    // Not a YouTube tab (no content script listening): open a calm YouTube.
    ext.tabs.create({ url: 'https://www.youtube.com/' });
  }
});

ext.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'calmyt:state' || !sender.tab) return;
  const title = !msg.home
    ? 'Calm YouTube — go to calm search'
    : msg.calm
      ? 'Calm YouTube — show the regular feed'
      : 'Calm YouTube — turn calm mode on';
  ext.browserAction.setTitle({ tabId: sender.tab.id, title });
});
