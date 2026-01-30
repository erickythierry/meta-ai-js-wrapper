
import { MetaAI } from './metaAI';

async function main() {
  const meta = new MetaAI();
  try {
    const resp = await meta.prompt("What is the capital of France?", { stream: false });
    console.log("Response:", resp);
    
    // Check if there are sources to fetch (async handling)
    if ((resp as any).fetchId) {
        console.log("Fetching sources for ID:", (resp as any).fetchId);
        const sources = await meta.fetchSources((resp as any).fetchId);
        console.log("Sources:", sources);
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
