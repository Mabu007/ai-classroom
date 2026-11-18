// A teacher-reviewed *starter* sequence, not an AI-generated response.
// These mathematical identities are exact; surface as "Guided lesson" in UI.
export const guidedLessonLength = 5;

const headings = [
  'What is factorisation?',
  'Find the factor pairs',
  'Work through an example',
  'Your turn to practise',
  'Check and reflect',
];
const steps = [
  {
    speech: "Welcome to our factorisation lesson! Imagine taking an expression apart to find the two brackets that made it. We will use simple number pairs and check our work by multiplying the brackets back out. Here is our first expression: x squared plus five x plus six.",
    board: [
      {type:'write_text',text:'FACTORISATION  •  GRADE 10',x:130,y:92},
      {type:'write_equation',text:'x² + 5x + 6',x:190,y:200},
      {type:'write_text',text:'A sum of terms → a product of brackets',x:190,y:300},
      {type:'draw_arrow',x:250,y:264,endX:420,endY:295}
    ]
  },
  {
    speech: "To factorise x squared plus five x plus six, look for two numbers that multiply to six and add to five. One times six gives six, but adds to seven. Two times three also gives six, and adds to five. That is the pair we want.",
    board: [
      {type:'write_text',text:'STEP 1  Find two numbers',x:130,y:455},
      {type:'write_equation',text:'p × q = 6',x:180,y:520},
      {type:'write_equation',text:'p + q = 5',x:180,y:600},
      {type:'write_text',text:'1 and 6 → sum 7   ✗',x:490,y:525},
      {type:'write_text',text:'2 and 3 → sum 5   ✓',x:490,y:605}
    ]
  },
  {
    speech: "Let us try another expression: x squared plus seven x plus ten. We need two numbers whose product is ten and whose sum is seven. Five and two work. So we write x plus five times x plus two. Expand those brackets to confirm the original expression.",
    board: [
      {type:'clear_whiteboard'},
      {type:'write_text',text:'WORKED EXAMPLE',x:130,y:100},
      {type:'write_equation',text:'x² + 7x + 10',x:160,y:180},
      {type:'write_text',text:'5 × 2 = 10    and    5 + 2 = 7',x:160,y:290},
      {type:'draw_arrow',x:300,y:330,endX:300,endY:400},
      {type:'write_equation',text:'(x + 5)(x + 2)',x:160,y:440}
    ]
  },
  {
    speech: "Now it is your turn! Factorise x squared plus five x plus six. Find the two numbers that multiply to six and add to five. Write your answer as two brackets. When you are ready, submit your answer in the question panel. I will wait.",
    board: [
      {type:'clear_whiteboard'},
      {type:'write_text',text:'YOUR TURN  •  PRACTISE',x:130,y:100},
      {type:'write_equation',text:'Factorise:  x² + 5x + 6',x:160,y:220},
      {type:'write_text',text:'Hint: two numbers multiply to 6 and add to 5',x:160,y:360}
    ],
    question:'Factorise x² + 5x + 6. Enter the two brackets.'
  },
  {
    speech: "Great work! The answer is x plus two times x plus three. When you expand, x squared plus three x plus two x plus six simplifies to x squared plus five x plus six. Remember the method: multiply to the constant, add to the x coefficient, and check by expanding.",
    board: [
      {type:'clear_whiteboard'},
      {type:'write_text',text:'SOLUTION & CHECK',x:130,y:100},
      {type:'write_equation',text:'x² + 5x + 6 = (x + 2)(x + 3)',x:130,y:225},
      {type:'write_equation',text:'x² + 3x + 2x + 6',x:130,y:405},
      {type:'write_equation',text:'= x² + 5x + 6  ✓',x:130,y:475},
      {type:'write_text',text:'Multiply → add → check',x:130,y:610}
    ]
  }
];

export function guidedLessonStep(stage) {
  if (!Number.isInteger(stage) || stage < 0 || stage >= steps.length) {
    throw new RangeError('Invalid lesson stage');
  }
  const data=steps[stage];
  return {
    heading:headings[stage],
    speech:data.speech,
    board:data.board.map(action=>({...action})),
    ...(data.question ? {question:data.question}:{}),
    origin:'guided'
  };
}

export function nextGuidedState(stage) {
  if(!Number.isInteger(stage) || stage<0 || stage>=steps.length) throw new RangeError('Invalid lesson stage');
  const nextStage=stage+1;
  return {
    stage:nextStage,
    status:stage===3?'awaiting_answer':nextStage===steps.length?'completed':'teaching'
  };
}
