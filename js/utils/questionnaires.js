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
          title: "Please mark on the 0 (No pain or symptom) - 10 (Worst pain or symptom imaginable) scale how much pain or symptom you have had in this area, on average, over the past week",
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
        },
        {
          type: "radiogroup",
          name: "mainArea",
          title: "Is this your main area of pain or symptom?",
          choices: ["Yes", "No"],
          isRequired: true
        },
        {
          type: "comment",
          name: "makingWorse",
          title: "What makes your pain or symptom worse?",
          maxLength: 300,
          visibleIf: "{mainArea} == Yes",
          isRequired: true
        },
        {
          type: "comment",
          name: "makingBetter",
          title: "What makes your pain or symptom better?",
          maxLength: 300,
          visibleIf: "{mainArea} == Yes",
          isRequired: true
        },
        {
          type: "radiogroup",
          name: "timeNotExperiencing",
          title: "Is there a time of day when you do not experience your pain or symptom?",
          choices: ["Yes", "No"],
          visibleIf: "{mainArea} == Yes",
          isRequired: true
        },
        {
          type: "checkbox",
          name:"timeNotExperiencingDetail",
          title: "If YES, when?",
          description: "Please check ALL that apply.",
          choices: [
            { 
              "value": "start-of-day",
              "text": "Start of your day"
            },
            {
              "value": "middle-of-day",
              "text" : "Middle of your day"
            },
            {
              "value": "end-of-day",
              "text": "End of your day"
            },
            {
              "value": "bedtime",
              "text": "Bedtime"
            },
            {
              "value": "sleeping",
              "text": "Sleeping"
            }
          ],
          maxSelectedChoices: 5,
          visibleIf: "{mainArea} == Yes and {timeNotExperiencing} == Yes",
          isRequired: true
        },
        {
          type: "radiogroup",
          name: "timeExperienceWorse",
          title: "Is there a time of the day when your pain or symptom get worse?",
          choices: ["Yes", "No"],
          visibleIf: "{mainArea} == Yes",
          isRequired: true
        },
        {
          type: "checkbox",
          name: "timeExperienceWorseDetail",
          title: "If YES, when?",
          description: "Please check ALL that apply.",
          choices: [
            { 
              "value": "start-of-day",
              "text": "Start of your day"
            },
            {
              "value": "middle-of-day",
              "text" : "Middle of your day"
            },
            {
              "value": "end-of-day",
              "text": "End of your day"
            },
            {
              "value": "bedtime",
              "text": "Bedtime"
            },
            {
              "value": "sleeping",
              "text": "Sleeping"
            }
          ],
          maxSelectedChoices: 5,
          visibleIf: "{mainArea} == Yes and {timeExperienceWorse} == Yes",
          isRequired: true
        },
        {
          type: "radiogroup",
          name: "onsetCause",
          title: "Was the onset of your current problem related to:",
          choices: [
            "Physical trauma (e.g., motor vehicle collision, fall, extreme exertion, workplace injury, etc.)",
            "A common physical actiity (e.g., exercise, putting on socks, typical lifting activities, etc.)",
            "Arthritis",
            "No clear event or cause"
          ],
          showOtherItem: true,
          otherPlaceholder: "Please describe...",
          otherText: "Other, please describe",
          visibleIf: "{mainArea} == Yes",
          isRequired: true
        },
        {
          type: "dropdown",
          name: "interfereActivity",
          title: "In the past 7 days, how much did this pain or symptom interfere with your day-to-day activities?",
          choices: [
            "Not at all",
            "A little bit",
            "Somewhat",
            "Quite a bit",
            "Very much"
          ],
          visibleIf: "{mainArea} == Yes",
          isRequired: true
        },
        {
          type: "radiogroup",
          name: "treatmentForImprovement",
          title: "Has any treatment improved this pain or symptom?",
          choices: ["Yes", "No"],
          visibleIf: "{mainArea} == Yes",
          isRequired: true
        },
        {
          type: "radiogroup",
          name: "treatmentForImprovementDetail",
          title: "If YES, what was the treatment",
          choices: [
            "Surgery",
            "Physiotherapy",
            "Injection",
            "Counselling"
          ],
          showOtherItem: true,
          otherPlaceholder: "Please describe...",
          otherText: "Other, please describe",
          visibleIf: "{mainArea} == Yes and {treatmentForImprovement} == Yes",
          isRequired: true
        },
        {
          type: "radiogroup",
          name: "medicationForImprovement",
          title: "We will ask for details about medications later in the survey. For this pain/symptom, have any medicaitons improved it?",
          choices: ["Yes","No"],
          visibleIf: "{mainArea} == Yes",
          isRequired: true
        },
        {
          type: "comment",
          name: "medicationForImprovementDetail",
          title: "If YES, what medication?",
          maxLength: 100,
          visibleIf: "{mainArea} == Yes and {medicationForImprovement} == Yes",
          isRequired: true
        }
      ]
    },
  ],
  showNavigationButtons: false
};
