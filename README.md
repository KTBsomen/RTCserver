# RTCserver
i am creating a new server to client push communication method based on webRTC 


use it in you html code like 

```
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <script src="./webrtcServer.js"></script>
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <script>
const server=new RTCserver("65464678ewtfsd6f8s79")
var ondata=(data)=>{
    console.log(data)
    server.sendResponse({status:200,data:"OK"})
}
try{server.listen(ondata,()=>{},(metadata)=>{console.log(metadata);return true})}
catch(err){
console.log(err.message)
}



    </script>
</body>
</html>
```
