const functions = require('firebase-functions');

//version: 0.5.0


/******************************************************************

                    SAVINGS

 *******************************************************************/

exports.removeSavingLine = functions.database
    .ref('/savings/{pushId}/lines/{pushId2}')
    .onWrite(event => {
        /*
    Funkcja wywoaływana podczas usuwania linii z savings
    1) usuń całą linię z savingLines
    2) usuń wszystkie savingItems dla savingLineId
*/

        if (event.data.exists()) {
            return; //wyjdź jeżeli dotyczy zapisu
        }
        const savingId = event.params.pushId;
        const savingLineId = event.params.pushId2;

        //console.log("Saving Id: ", savingId);
        //console.log("Saving Line Id: ", savingLineId);

        const root = event.data.ref.root;
        const slRef = root.child(`/savingLines/${savingLineId}`);
        let savingItemIds = [];
        return slRef.once('value')
            .then(snap => {
                const savingLine = snap.val();
                if (savingLine && savingLine.hasOwnProperty('savingItems')) {
                    Object.keys(savingLine.savingItems).forEach(function (key) {
                        return root.child(`/savingItems/${key}`).remove();
                    });
                }

                return slRef.remove();
            })
            .catch(error => {
                console.log(error);
            })

    });



/******************************************************************

                    BUDGET

 *******************************************************************/


exports.addOutgo = functions.database
    .ref('/outgoes/{pushId}')
    .onWrite(event => {
        /*
    Funkcja wywoaływana podczas dodania nowej pozycji w bazie outgoes
    1) dodaj outgo ID do odpowiedniej linii
    2) zmniejsz w linii cashLeft
    3) zwiększ w linii noOutgoes
    4) w budget zmniejsz cashLeft
*/
        let budgetId = null;
        const outgoId = event.params.pushId;
        const amount = event.data.val().amount;
        const budgetLineId = event.data.val().budgetLineId;
        const root = event.data.ref.root;
        const blRef = root.child(`/budgetLines/${budgetLineId}`);
        return blRef.once('value')
            .then(snap => {
                const budgetLine = snap.val();
                if (!budgetLine.hasOwnProperty('noOutgoes')) {
                    //jeżeli nie ma żadnego outgo to utwórz noOutgoes z 0
                    Object.assign(budgetLine, { noOutgoes: 0 });
                }
                budgetLine.noOutgoes = ++budgetLine.noOutgoes;
                budgetLine.cashLeft -= amount;
                budgetId = budgetLine.budgetId;
                if (!budgetLine.hasOwnProperty('outgoes')) {
                    //jeżeli nie ma żadnego outgo to utwórz obiekt
                    //     console.log("Nie ma property outgoes!");
                    Object.assign(budgetLine, { outges: { [outgoId]: true } });
                } else {
                    //w przeciwnym wypadku dodaj tylko referencję
                    Object.assign(budgetLine.outgoes, { [outgoId]: true });
                }
                //   console.log("budgetLine from Cloud Functions: ", budgetLine);
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

    });

exports.addSavingItem = functions.database
    .ref('/savingItems/{pushId}')
    .onWrite(event => {
        /*
    Funkcja wywoaływana podczas dodania nowej pozycji w bazie savingItems
    1) dodaj saving ID do odpowiedniej linii
    2) zwiększ w linii cashLeft
    4) w savings zmniejsz cashLeft (total)
    5) w odpowiedniej linii dodaj savingItem
*/

        let savingId = null;
        const savingItemId = event.params.pushId;
        const amount = event.data.val().amount;
        const savingLineId = event.data.val().savingLineId;
        const root = event.data.ref.root;
        const slRef = root.child(`/savingLines/${savingLineId}`);
        return slRef.once('value')
            .then(snap => {
                const savingLine = snap.val();
                savingLine.cashLeft += amount;
                savingId = savingLine.savingId;
                if (!savingLine.hasOwnProperty('savingItems')) {
                    //jeżeli nie ma żadnego outgo to utwórz obiekt
                    //  console.log("Nie ma property savingItems!");
                    Object.assign(savingLine, { savingItems: { [savingItemId]: true } });
                } else {
                    //w przeciwnym wypadku dodaj tylko referencję
                    Object.assign(savingLine.savingItems, { [savingItemId]: true });
                }
                //   console.log("savingLine from Cloud Functions: ", savingLine);
                return slRef.set(savingLine)
            }).then(() => {
                return root.child(`/savings/${savingId}`).once('value')
            })
            .then(snap => {
                const saving = snap.val();
                saving.totalCash += amount;
                return root.child(`/savings/${savingId}`).set(saving)
            })
            .catch(error => {
                console.log(error);
            })

    });
