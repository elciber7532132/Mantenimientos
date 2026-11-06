self.addEventListener('push', event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'MARTÍNEZ | Gestión Vehicular',
      body: event.data ? event.data.text() : 'Tienes una nueva alerta.'
    };
  }

  const title = data.title || 'MARTÍNEZ | Gestión Vehicular';

  const options = {
    body: data.body || data.message || 'Hay una alerta pendiente en la flota.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'martinez-alerta',
    renotify: true,
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const destination = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus();
        }
      }

      return clients.openWindow(destination);
    })
  );
});
