self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(
    data.title || 'MARTÍNEZ Gestión Vehicular',
    {
      body: data.body || 'Tienes una alerta pendiente de la flota.',
      data: { url: data.url || '/' },
      tag: data.tag || 'martinez-alerta',
      renotify: false
    }
  ));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || '/',
    self.location.origin
  ).href;
  event.waitUntil((async () => {
    const openClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    for (const client of openClients) {
      if (client.url.startsWith(self.location.origin)) {
        await client.focus();
        if (client.navigate) await client.navigate(target);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});
