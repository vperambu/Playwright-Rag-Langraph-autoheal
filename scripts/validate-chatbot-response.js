const response = { status: 200, body: 'Hello from chatbot' };
if (response.status !== 200) {
  console.error('Chatbot response failed');
  process.exit(1);
}
console.log('Chatbot response is valid:', response.body);
