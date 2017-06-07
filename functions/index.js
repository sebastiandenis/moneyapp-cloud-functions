const functions = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.helloWorld = functions.https.onRequest((request, response) => {
    response.send("Hello from Firebase!");
    console.log("Hello form console of Firebase!");
});

exports.addOutgo = functions.database
    /*
        Funkcja wywoaływana podczas dodania nowej pozycji w bazie outgoes
        1) dodaj outgo ID do odpowiedniej linii
        2) zmniejsz w linii cashLeft
        3) zwiększ w linii noOutgoes
        4) w budget zmniejsz cashLeft
    */
    .ref('/outgoes/{pushId}')
    .onWrite(event => {
        let budgetId = null;
        const outgoId = event.params.pushId;
        const amount = event.data.val().amount;
        const budgetLineId = event.data.val().budgetLineId;
        const root = event.data.ref.root;
        const blRef = root.child(`/budgetLines/${budgetLineId}`);
        return blRef.once('value')
            .then(snap => {
                const budgetLine = snap.val();
                budgetLine.noOutgoes = ++budgetLine.noOutgoes;
                budgetLine.cashLeft -= amount;
                budgetId = budgetLine.budgetId;
                Object.assign(budgetLine.outgoes, { [outgoId]: true });
                return blRef.set(budgetLine)
            }).then(() => {
                return root.child(`/budgets/${budgetId}`).once('value')
            })
            .then(snap => {
                const budget = snap.val();
                budget.cashLeft -= amount;
                return root.child(`/budgets/${budgetId}`).set(budget)
            })
            .catch(error => {
                console.log(error);
            })

    })
