export const generalSurveyJson = {
  title: "General Questionnaire",
  showQuestionNumbers: "off",
  showTitle: false,
  pages: [
    {
      name: "page1",
      elements: [
        {
          type: "radiogroup",
          name: "stressful",
          title: "At the time of your problem onset, was it a stressful time in your life?",
          choices: ["Yes", "No"],
          isRequired: true
        },
        {
          type: "radiogroup",
          name: "medication",
          title: "Do you take medications (prescription and/or over-the-counter) for your spinal pain?",
          choices: ["Yes", "No"],
          isRequired: true
        },
        {
          type: "matrix",
          name: "medicationTable",
          title: "Please indicate the medications you take for your spinal pain, including frequency of use.",
          columns: [
            {
              "value": "baseline",
              "text": "Routinely Taking (Baseline)"
            },
            {
              "value": "breakthrough",
              "text": "Taking as Needed (Breakthrough)"
            },
            {
              "value": "none",
              "text": "Not Taking"
            }
          ],
          rows: [
            {
                "value": "over-the-counter",
                "text": "Over the Counter (from a shop)"
            },
            {
                "value": "non-steroidal-anti-inflammatory",
                "text": "Non-Steroidal Anti-Inflammatory"
            },
            {
                "value": "muscle-relaxant",
                "text": "Muscle Relaxant"
            },
            {
                "value": "narcotic-pain-medication",
                "text": "Narcotic Pain Medication"
            },
            {
                "value": "anti-depressant",
                "text": "Anti-Depressant"
            },
            {
                "value": "neuroleptics",
                "text": "Neuroleptics (agents to calm nerve pain)"
            },
            {
                "value": "cannabis",
                "text": "Cannabis"
            },
          ],
          eachRowRequired: true,
          isRequired: true
        },
        {
          type: "radiogroup",
          name: "narcoticPainDuration",
          title: "If you indicated that you have taken Narcotic Pain Medication, how long have you taken narcotic pain medication?",
          choices: [
            "Less than 6 weeks", 
            "6 weeks to less than 12 weeks",
            "12 weeks to less than 1 year",
            "Greater than 1 year"
          ],
          isRequired: true
        },
        {
          type: "comment",
          name: "medicationComment",
          title: "Are there any further comments you feel are important to your use of medication and/or other remedies that you may use?",
          maxLength: 300
        }
      ]
    },
  ],
  showNavigationButtons: false
};
