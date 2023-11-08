# Discord OAuth 2.0 Upload App
This is a upload application that allows users to authenticate with their Discord accounts and upload files. The server is built using the Express framework and connects to a MongoDB database.


> [!WARNING]  
> This project is unfinished and unpolished, there are bugs, there are missing things, or code that straight up does not work as intended. 

Installation
To install the server, you will need to have Node.js and a MongoDB server. You can then install the dependencies and start the server by running the following 

commands:
```
npm instal 
node .
```

## Configuration
The server is configured using a `config.json` file. 
This file contains the following properties:

```
{
    "mongoURI":"MONGO_CONNECT_URI",
    "redirectURL":"URL FOR DISCORD REDIRECT (BASE URL)",
    "clientID" : "DISCORD_CLIENT_ID",
    "clientSecret" : "DISCORD_CLIENT_SECRET",
    "secretCookieString": "LONG STRING OF SOMETHING",
    "webhookId":"WEBHOOK_ID",
    "webhookToken": "WEBHOOK_TOKEN"
}
```

Routes

> [!NOTE]  
> Most endpoints use 2 headers, X-User-ID & X-API-KEY, along with a body form for files or requests.

The server has the following routes:
- `/login`: This route handles user authentication and authorization.
- `/logout`: Destroys your current session
- `/callback`: Used to auth with discord
- `/admin`: This route handles administrative tasks, such as managing users and files.
- `/admin/delete-user`: Delete a user, all their data, and their files. 
- `/admin/update-storage-limit`: Upadate a users storage limit
- `/upload`: This route handles file uploads.
- `/info`: Spits out all your information when your logged in.
- `/file`: Used to view files you have uploaded
- `/files/api`: Handles the loading of files like a timeline

## Storage
The server stores uploaded files in a uploads directory. The default storage limit is 10GB, you can by default upload 500MB files. You can change the storage limit by updating a user in MongoDB or through the admin panel. 

## Running the Server
The server will listen on port 3000 by default.

## License
This server is licensed under the MIT license.
