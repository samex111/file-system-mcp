import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: ' ',
  baseURL: 'https://integrate.api.nvidia.com/v1',
})

 
async function main() {
    // @ts-ignore
  const completion = await openai.chat.completions.create({
    model: "deepseek-ai/deepseek-v4-pro",
    messages: [{"content":"what is the meaning of life ","role":"user"}],
    temperature: 1,
    top_p: 0.95,
    max_tokens: 16384,
    chat_template_kwargs: {"thinking":false} as any,
    stream: true
  })
   
  for await (const chunk of completion) {
        process.stdout.write(chunk.choices[0]?.delta?.content || '')
    
  }
  
}

main();