const functions = require('firebase-functions');

//version: 0.8.0


/******************************************************************

                    SAVINGS

 *******************************************************************/

exports.addSavingLine = functions.database
    .ref('/savingLines/{pushId}')
    .onWrite(event => {
        /*
    Funkcja wywoaływana podczas dodania nowej linii
    1) dodaj linię do savings (jeżeli dodanie)
    2) zwiększ w savings cash left
    3) różnicę pomiędzy nową wartością linii, a wartością w savings dodaj jako savingItem
    
*/

        // Only add data when it is new.
        if (event.data.previous.exists()) {
            return;
        }
        // Exit when the data is deleted.
        if (!event.data.exists()) {
            return;
        }


        const savingId = event.data.val().savingId;
        const savingLineId = event.params.pushId;
        const newAmount = event.data.val().cashLeft;


        const root = event.data.ref.root;
        const sRef = root.child(`/savings/${savingId}`);

        const newSavingItemKey = root.child(`/savingItems/`).push().key;
        const siRef = root.child(`/savingItems/${newSavingItemKey}`);
        // console.log("New saving item key: ", newSavingItemKey);
        return sRef.once('value')
            .then(snap => {
                const saving = snap.val();
                saving.totalCash += newAmount //dodaj różnicę
                if (!saving.hasOwnProperty('lines')) {
                    //jeżeli nie ma żadnej linii to utwórz obiekt
                    Object.assign(saving, { lines: { [savingLineId]: true } });
                } else {
                    //w przeciwnym wypadku dodaj tylko referencję
                    Object.assign(saving.lines, { [savingLineId]: true });
                }
                savPromise = sRef.set(saving);
                let newSavingItem = {};
                Object.assign(newSavingItem, { amount: newAmount, savingLineId: savingLineId, initial: true });
                siPromise = siRef.set(newSavingItem);




                return Promise.all([savPromise, siPromise]);
            })
            .catch(error => {
                console.log(error);
            })

    });


exports.editSavingLine = functions.database
    .ref('/savingLines/{pushId}')
    .onWrite(event => {
        /*
    Funkcja wywoaływana podczas dodania nowej lub edycji istniejącej linii
    1) dodaj linię do savings (jeżeli dodanie)
    2) zwiększ w savings cash left
    3) różnicę pomiędzy nową wartością linii, a wartością w savings dodaj jako savingItem

    
*/

        // Only edit data when it is edited.
        if (!event.data.previous.exists()) {
            return;
        }
        // Exit when the data is deleted.
        if (!event.data.exists()) {
            return;
        }


        const savingId = event.data.val().savingId;
        const savingLineId = event.params.pushId;
        const prevAmount = event.data.previous.val().cashLeft;
        const newAmount = event.data.val().cashLeft;


        const root = event.data.ref.root;
        const sRef = root.child(`/savings/${savingId}`);
        return sRef.once('value')
            .then(snap => {
                const saving = snap.val();
                saving.totalCash += (newAmount - prevAmount); //dodaj różnicę
                return sRef.set(saving)
            })
            .catch(error => {
                console.log(error);
            })

    });



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
        let slCashLeft = 0;
        let savingItemIds = [];
        const promisesArray = [];
        return slRef.once('value')
            .then(snap => {
                const savingLine = snap.val();
                slCashLeft = savingLine.cashLeft;
                if (savingLine && savingLine.hasOwnProperty('savingItems')) {
                    Object.keys(savingLine.savingItems).forEach(function (key) {
                        promisesArray.push(root.child(`/savingItems/${key}`).remove());
                        //   return root.child(`/savingItems/${key}`).remove();
                    });
                }
                //     console.log("Rozmiar tabei promisesArray: ", promisesArray.length);
                promisesArray.push(slRef.remove());
                return Promise.all(promisesArray);
            })
            .then(() => {
                return root.child(`/savings/${savingId}`).once('value')
            })
            .then(snap => {
                const saving = snap.val();
                // console.log("Total cash przed redukcją: ", saving.totalCash, ", redukujemy o: ", slCashLeft);
                saving.totalCash -= slCashLeft;
                return root.child(`/savings/${savingId}`).set(saving)
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

        if (event.data.previous.exists()) {
            return; //tylko gdy dodajemy nowe
        }

        // Exit when the data is deleted.
        if (!event.data.exists()) {
            return;
        }

        if(event.data.val().initial){
            return;
        }




        let savingId = null;
        const savingItemId = event.params.pushId;
        const amount = event.data.val().amount;
        //    console.log("Amount w saving item id: ", savingItemId, " = ", amount);
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
                    Object.assign(savingLine, { savingItems: { [savingItemId]: true } });
                } else {
                    //w przeciwnym wypadku dodaj tylko referencję
                    Object.assign(savingLine.savingItems, { [savingItemId]: true });
                }
                return slRef.set(savingLine)
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

        if (event.data.previous.exists()) {
            return; //tylko gdy dodajemy nowe
        }
        // Exit when the data is deleted.
        if (!event.data.exists()) {
            return;
        }


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

