const axios = require('axios');

const data = {
  storageLimit: '100',
  userID: '64f22afc0303f6c436caa5ac'
};

axios.post('https://b956-80-193-46-145.ngrok-free.app/admin/update-storage-limit', data, {
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log(response.data);
})
.catch(error => {
  console.error(error);
});