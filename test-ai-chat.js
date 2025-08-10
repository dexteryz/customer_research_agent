// Simple test script to verify AI Chat RAG functionality
// Run with: node test-ai-chat.js (when server is running)

const testQueries = [
  "What are the main customer pain points?",
  "Summarize the key insights from customer feedback",
  "What improvements do customers want?",
  "Show me customer quotes about our product",
  "What are customers saying about pricing?"
];

async function testRAGEndpoint() {
  console.log('🧪 Testing AI Chat RAG Functionality\n');
  
  const baseUrl = 'http://localhost:3002'; // Adjust port if needed
  
  for (const [index, query] of testQueries.entries()) {
    console.log(`\n📝 Test ${index + 1}: "${query}"`);
    console.log('─'.repeat(60));
    
    try {
      const response = await fetch(`${baseUrl}/api/rag-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          topK: 5,
          conversationHistory: ''
        }),
      });
      
      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.log(`❌ API Error: ${data.error}`);
        if (data.details) {
          console.log(`   Details: ${data.details}`);
        }
      } else {
        console.log(`✅ Success!`);
        console.log(`📊 Answer: ${data.answer?.substring(0, 200)}...`);
        console.log(`🔍 Sources Found: ${data.results?.length || 0}`);
        console.log(`📈 Total Results: ${data.totalResults || 'N/A'}`);
      }
      
    } catch (error) {
      console.log(`❌ Request Failed: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n🎉 Testing Complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. Open http://localhost:3002 in your browser');
  console.log('2. Scroll down to the "AI Research Assistant" section');
  console.log('3. Try asking questions about your customer data');
  console.log('4. Upload customer feedback files to get better results');
}

// Run the test if this script is executed directly
if (require.main === module) {
  testRAGEndpoint().catch(console.error);
}

module.exports = { testRAGEndpoint };