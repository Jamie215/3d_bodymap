export const HELP_CONTENT = {
    drawing: [
        { 
            q: 'How do I use the form?', 
            a: [
                { type: 'video', videoId: '2LGwMr0mNc4', provider:  'youtube' },
            ] 
        },
        {
            q: 'How do I mark where I feel my pain or symptom?',
            a: [
                { type: 'text', content: 'Select the "Draw" button, then click and drag on the body to highlight the area where you feel pain or symptoms. Use the slider to change the size of the brush.' },
                { type: 'video', videoId: 'FGc40Py935Q', provider: 'youtube' }
            ]
        },
        {
            q: 'Can I change or erase what I drew?',
            a: [
                { type: 'text', content: 'Yes - select the "Erase" button to switch to erase mode. Then place your mouse cursor over the drawing, click and hold to erase. You can switch back to drawing mode by selecting the "Draw" button.' },
                { type: 'video', videoId: 'oScNkq656Jw', provider: 'youtube' }
            ]
        },
        {
            q: 'The body part on my screen is not where I want to draw on - how do I change it?',
            a: [
                { type: 'text', content: 'Click on "Select Body Region" on the bottom left of the screen to open a dropdown list of body areas. Choose a region to update the view so it focuses on that part of the body.' },
                { type: 'video', videoId: 'pqxVb4QX4PQ', provider: 'youtube' }
            ]
        },
        {
            q: 'The body area is not zoomed in or out enough - how can I adjust the zoom?',
            a: [
                { type: 'text', content: 'If you are using a computer, place your cursor over the area you want to adjust and use the scroll wheel to zoom in or out.' },
                { type: 'text', content: 'If you are using a touchscreen device, pinch your fingers together or apart on the screen to zoom in or out.' },
                { type: 'video', videoId: 'mcJio_POOyA', provider: 'youtube'}
            ]
        },
        {
            'q': 'How do I turn the body part to see the side or back?',
            'a': [
                { type: 'text', content: 'Use the arrows to rotate the body so you can view it from different angles.' },
                { type: 'video', videoId: 'gKJy760HXyo', provider: 'youtube' }
            ]
        }
    ],
    summary: [
        { 
            'q': 'Can I change the pain or symptom I previously drew?', 
            'a': [
                { type: 'text', content: 'Yes, you can change the pain or symptom you previously drew by selecting the "Edit" button. This will return you to the drawing page, where you can add to or erase parts of your drawing.' },
                {type: 'image', src: 'assets/help/Edit.png', alt: 'Screenshot showing the "Edit" button'}
            ]
        },
        {
            'q': 'What do I do next after I finish my first drawing?', 
            'a': [
                { type: 'text', content: 'To log additional pain or symptoms, select "Add a New Pain or Symptom.". When you are done adding all drawing, select "Proceed to General Questionnaire".' },
                { type: 'image', src: 'assets/help/Next Steps.png', alt: 'Screenshot showing the "Add a New Pain or Symptom" and "Proceed to General Questionnaire" buttons' }
            ]
        }
    ]
};