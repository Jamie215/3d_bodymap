export const surveyJson = {
  title: "Area-Specific Questionnaire",
  showQuestionNumbers: "off",
  showTitle: false,
  pages: [
    {
      name: "page1",
      elements: [
        {
          type: "text",
          name: "description",
          title: "What does your pain or symptom feel like?",
          isRequired: true
        },
        {
          type: "radiogroup",
          name: "firstEpisode",
          title: "Is this your first episode of this pain/symptom?",
          choices: ["Yes", "No"],
          isRequired: true
        },
        {
          type: "rating",
          name: "severity",
          title: "What is the degree of severity of pain or symptom in this area?",
          rateValues: [
            {
              "value": "mild",
              "text": "Mild"
            },
            {
              "value": "moderate",
              "text": "Moderate"
            },
            {
              "value": "severe",
              "text": "Severe"
            }
          ],
          isRequired: true
        },
        {
          type: "radiogroup",
          name: "frequency",
          title: "Is this pain or symptom...",
          choices: ["Always there", "Comes and goes"],
          isRequired: true
        },
      ]
    },
    {
      name: "page2",
      elements: [
        {
          type: "dropdown",
          name: "duration",
          title: "How long have you had this pain or symptom?",
          choices: ["Less than 7 days", 
                    "7 days to less than 1 month", 
                    "1 month to less than 3 months", 
                    "3 months to less than 6 months", 
                    "6 months to less than 1 year", 
                    "1-5 years", "More than 5 years"],
          isRequired: true
        },
        {
          type: "rating",
          name: "intensityScale",
          title: "Please mark on the 0-10 scale how much pain or symptom you have had in this area, on average, over the past week",
          minRateDescription: "No pain or symptom",
          maxRateDescription: "Worst pain or symptom imaginable",
          displayMode: "dropdown",
          rateCount: 11,
          rateMin: 0,
          rateMax: 10,
          isRequired: true
        },
        {
          type: "comment",
          name: "comment",
          title: "Is there anything else you would like to tell us about this pain or symptom? (Optional)",
          maxLength: 200
        }
      ]
    }
  ],
  completeText: "Done"
};
