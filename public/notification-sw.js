// Custom notification click handler for PWA
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and send the notification data
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'notification-click',
            notification: data,
          });
          return;
        }
      }
      // Otherwise open the app
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
