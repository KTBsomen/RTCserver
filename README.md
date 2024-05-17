# RTCserver
i am creating a new server to client push communication method based on webRTC 

```
https://cdn.jsdelivr.net/gh/KTBsomen/RTCserver@main/RTCserver/index.js
```
use it in your HTML code like 

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FCM & WebRTC Notifier Test</title>
</head>

<body>
  <h1>FCM & WebRTC Notifier Demo</h1>
  <div id="token_div">
    <label for="token">FCM Registration Token:</label>
    <output id="token"></output>
  </div>
  <div id="permission_div">
    <button id="request-permission-button">Request Permission</button>
  </div>
  <div id="messages"></div>
  <script src="https://cdn.jsdelivr.net/gh/KTBsomen/RTCserver@main/RTCserver/index.js"></script>
  <script>
    const rtcserver = new RTCserver({
      firebaseConfig: {
        apiKey: "your apikey",
        authDomain: "yourapp-da2d9.firebaseapp.com",
        projectId: "yourapp-da2d9",
        storageBucket: "yourapp-da2d9.appspot.com",
        messagingSenderId: "yourapp",
        appId: "yourapp-6fd70d3941c3",
        measurementId: "G-yourapp",
      },
      vapidKey: "your vapid",
      useServiceWorker: true,
      tokenServer: "http://localhost:3000/store/token/",
      tokenUserId: "somen",
      peerJsOptions: { id: "65464678ewtfsd6f8s79" }
    });
    document.getElementById('request-permission-button').addEventListener('click', async () => {
      try {
        var token = await rtcserver.getRegistrationToken()
        console.log(token);
      } catch (error) {
        console.log(error);
      }
    });
    rtcserver.onNotification = (payload) => {
      console.log('New notification received:', payload);
      document.getElementById("messages").append(JSON.stringify(payload));
    };
  </script>
</body>

</html>
```
you must have a service worker file present at the root. check with the name `firebase-messaging-sw.js` 
