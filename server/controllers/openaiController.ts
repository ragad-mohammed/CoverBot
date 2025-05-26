import { RequestHandler } from 'express';
import { ServerError } from '../types';
import OpenAI from "openai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new OpenAI({apiKey: process.env.OPEN_AI_KEY});

export const queryOpenAI: RequestHandler = async (_req, res, next) => {
  const { naturalLanguageQuery } = res.locals;
  if (!naturalLanguageQuery) {
    const error: ServerError = {
      log: 'OpenAI query middleware did not receive a query',
      status: 500,
      message: { err: 'An error occurred before querying OpenAI' },
    };
    return next(error);
  }

const role = `You're an expert job search consultant who is helping a client seek a new tech role`
const task = `
        The user content will be a job description.  
        1. read through the job description and identify the target audience, key skills and company values
        2. read through the resume provided below and find relevant experience to the job description
        3. Keep it concise and under 250 word and Avoid repeating resume.
        4. format a cover letter for the candidate in the following structure:

        Dear [target audience],

        cover letter content

        All Best, 
        Ragad Mohammed
        619-792-8081
        r1mohamm@gmail.com
`;

// Read resume from file
// const resumeFilePath = path.join(__dirname, '../data/resume.docx');
const resume = `RAGAD MOHAMMED r1mohamm@gmail.com
(619)792-8081
SOFTWARE ENGINEER
linkedin.com/in/ragad/
github.com/ragad-mohammed
TECHNICAL SKILLS
Languages & Technologies: JavaScript (ES6+), TypeScript, Python, HTML/CSS, React (Hooks, Router, Redux), Node.js, Express.js,
Mongoose, Jest, Git, Webpack, Docker, AWS, MongoDB, SQL
Skills: Wireframing, Test-Driven Development (TDD), RESTful APIs, OAuth
PROFESSIONAL EXPERIENCE
Software Engineer at Reactime
2024 — Present
Leveraged React DevTools Global Hook to navigate the React Fiber tree, capturing state and render time with throttled
updates. Implemented listeners and Chrome local storage to enable time-travel debugging and performance monitoring.
Developed a React component to display context providers and consumers from useContext hook, utilizing recursive data
parsing and custom JSON visualization, increasing development speed and productivity, reducing debugging time by 50%.
Deployed Webpack to bundle a Chrome Extension build, managing multiple entry points and complex dependencies such as
TSX and JSX transpiling for uglifying and minifying code for an optimized, production-ready package for deployment.
Optimized unit and integration tests using Jest, including scenarios such as missing React DevTools, and handling of port
disconnection events, enhancing reliability and functionality by achieving 85% test coverage across key components.
Engineer at QuidelOrtho, General Atomics
2017 — 2024
Automated the extraction and aggregation of measurement data from excel files by developing a Python script that utilized
Pandas and OS libraries for data manipulation, streamlining the analysis process and reducing processing time by 80%.
Programmed an automated measurement system using LabVIEW to enhance precision and efficiency, enabling seamless
integration into a larger system for improved quality control, increasing production accuracy by 15%.
Applied data analysis software to analyze production inefficiencies, and implement solutions, improving throughput by 25% and
achieving $100K in annual cost savings.
ENGINEERING PROJECTS
BetterReads | Book Tracking App
Engineered a modular and flexible backend server using Express, implementing RESTful architecture to handle requests, query
databases, and send appropriate responses. Designed middleware for efficient request routing, body parsing, API data
fetching, and persistence through chaining, ensuring a fast, minimal, and scalable server structure.
Designed a relational database schema in PostgreSQL, including user, book, and many-to-many relationship tables, with
foreign key constraints and indexed columns to ensure data integrity, scalability, and efficient querying.
Built a responsive React component using Material-UI to display a grid of book cards, leveraging styled typography, consistent
image rendering, and flexible layouts to create a visually appealing, user-friendly interface that enhances accessibility.
EDUCATION
University of California, San Diego
Master of Science in Engineering
Bachelor of Science in Chemical Engineering | Magna Cum Laude
TALKS/ PUBLICATIONS
Tech Talk | Kubernetes in Artificial Intelligence and Machine Learning Processes
Medium | Reactime Reimagined: A Major Leap Forward in React Debugging
INTERESTS
Solo Traveling (Colosseum, Machu Picchu, Petra, Chichén Itzá) | Yoga and Meditation Retreats | Coffee Enthusiast`

const rules = `
  1. output format should be in markdown formatted left justified, single spaced with 2 lines between paragraphs and after the salutation. Like a letter 
  2. It should not include ANY additional content than the cover letter itself          
  3. don't lie or make up any experience to better fit the job description, only use the experience listed and what can be logically inferred from that experience
  4. don't directly quote anything from the job description.  If you want to tie a link between experience and job requirements, at least change the wording enough so its not a direct pull
`;

const systemPrompt = `
  ${role}
  ${task}

  ${resume}

  Rules: 
  ${rules}
`

 //  Path to the queries.json file
 const queriesFilePath = path.join(__dirname, '../data/cover_letters.json');

 // Read and update the queries.json file
 let queriesData: Record<string, Array<{returnedQuery: string;}>> = {};
 if (fs.existsSync(queriesFilePath)) {
   const fileContent = fs.readFileSync(queriesFilePath, 'utf-8');
   queriesData = fileContent ? JSON.parse(fileContent) : {};
 }


  try {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      { role: "user", content: naturalLanguageQuery },
    ],
    temperature: 0.3,
    max_completion_tokens: 500,
  });
  
  const returnedQuery = response.choices[0].message.content
  ? response.choices[0].message.content : null;


  if (!returnedQuery) {
    const error: ServerError = {
      log: 'OpenAI did not return a valid SQL query',
      status: 500,
      message: { err: 'An error occurred while querying OpenAI' },
    };
    return next(error);
  }
 
     // Update the queries object
     if (!queriesData[naturalLanguageQuery]) {
       queriesData[naturalLanguageQuery] = [];
     }
     queriesData[naturalLanguageQuery].push({ returnedQuery });
 
     // Write the updated object back to the file
     fs.writeFileSync(queriesFilePath, JSON.stringify(queriesData, null, 2), 'utf-8');

  res.locals.coverLetter = returnedQuery;
  return next();
}
  catch (err) {
    const error: ServerError = {
      log: `OpenAI query failed: ${(err as Error).message}`,
      status: 500,
      message: { err: 'An error occurred while querying OpenAI' },
    };
    return next(error);
  }
};
