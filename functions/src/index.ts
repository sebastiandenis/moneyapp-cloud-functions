import * as functions from 'firebase-functions';
//version: 0.13.0
/******************************************************************
                    SAVINGS
 *******************************************************************/

export let addSavingsLine = functions.database.ref('/savingsLines/{pushId}').onCreate(event => {
    /*
Funkcja wywoaływana podczas dodania nowej linii
1) dodaj linię do savings (jeżeli dodanie)
2) zwiększ w savings cash left
3) różnicę pomiędzy nową wartością linii, a wartością w savings dodaj jako savingItem
*/


    const savingsId = event.data.val().savingsId;
    const savingsLineId = event.params.pushId;
    const newAmount = event.data.val().cashLeft;


    const root = event.data.ref.root;
    const savingsRef = root.child(`/savings/${savingsId}`);

    const newSavingsItemKey = root.child(`/savingsItems/`).push().key;
    const savingsItemsRef = root.child(`/savingsItems/${newSavingsItemKey}`);
    const savingsItemsInSavingsLinesRef = root.child(`/savingsItemsInSavingsLines/`);
    const linesInSavingsRef = root.child(`/linesInSavings/`);
    // console.log("New saving item key: ", newSavingItemKey);
    return savingsRef.once('value')
        .then(snap => {
            const savings = snap.val();
            savings.totalCash += newAmount //dodaj różnicę
            let savPromise = savingsRef.set(savings);
            let newSavingsItem = {};
            (<any>Object).assign(newSavingsItem, { amount: newAmount, savingsLineId: savingsLineId, initial: true });
            let siPromise = savingsItemsRef.set(newSavingsItem);
            savingsItemsInSavingsLinesRef.child(`${savingsLineId}`).set({[newSavingsItemKey]: true});
            linesInSavingsRef.child(`${savingsId}`).set({savingsLineId: true});


            return Promise.all([savPromise, siPromise]);
        })
        .catch(error => {
            console.log(error);
        });
});


export let editSavingsLine = functions.database.ref('/savingsLines/{pushId}').onUpdate(event => {
    /*
    Funkcja wywoaływana podczas dodania nowej lub edycji istniejącej linii
    1) dodaj linię do savings (jeżeli dodanie)
    2) zwiększ w savings cash left
    3) różnicę pomiędzy nową wartością linii, a wartością w savings dodaj jako savingItem

    
*/


    const savingsId = event.data.val().savingsId;
    const savingsLineId = event.params.pushId;
    const prevAmount = event.data.previous.val().cashLeft;
    const newAmount = event.data.val().cashLeft;


    const root = event.data.ref.root;
    const sRef = root.child(`/savings/${savingsId}`);
    return sRef.once('value')
        .then(snap => {
            const savings = snap.val();
            savings.totalCash += (newAmount - prevAmount); //dodaj różnicę
            return sRef.set(savings)
        })
        .catch(error => {
            console.log(error);
        });

});


export let removeSavingsLine = functions.database.ref('/savingsLines/{pushId}').onDelete(event => {
    /*
      Funkcja wywoaływana podczas usuwania linii z savings
      1) usuń całą linię z savingLines
      2) usuń wszystkie savingItems dla savingLineId
  */


    // const savingId = event.params.pushId;
    const savingsLineId = event.params.pushId;
    const deletedSavingsLine = event.data.previous.val();

    const root = event.data.ref.root;
    //    const slRef = root.child(`/savingLines/${savingLineId}`);

    const savingsItemsInSavingsLinesRef = root.child(`/savingsItemsInSavingsLines/${savingsLineId}`);
    const linesInSavings = root.child(`/linesInSavings/${deletedSavingsLine.savingsId}`);

    const promisesArray = [];
    return savingsItemsInSavingsLinesRef.once('value')
        .then(snap => {
            //usuwanie savingsItems
            const savingsItemsInSavingsLines = snap.val();

            Object.keys(savingsItemsInSavingsLines).forEach(function (key) {
                promisesArray.push(root.child(`/savingsItems/${key}`).remove());
            });
            //       savingsItemsInSavingsLinesRef.remove();

            promisesArray.push(savingsItemsInSavingsLinesRef.remove());

            return Promise.all(promisesArray);
        })
        .then(()=>{
            return linesInSavings.once('value')
        })
        .then(snap => {
            const ls = snap.val();
            ls[savingsLineId] = null;
            return root.child(`/linesInSavings/${deletedSavingsLine.savingsId}`).update(ls);
        })
        .then(() => {
            return root.child(`/savings/${deletedSavingsLine.savingsId}`).once('value');
        })
        .then(snap => {
            const savings = snap.val();
            // console.log("Total cash przed redukcją: ", saving.totalCash, ", redukujemy o: ", slCashLeft);
            savings.totalCash -= deletedSavingsLine.cashLeft;
            return root.child(`/savings/${deletedSavingsLine.savingsId}`).set(savings);
        })
        .catch(error => {
            console.log(error);
        });
});

export let addSavingsItem = functions.database.ref('/savingsItems/{pushId}').onCreate(event => {
    /*
  Funkcja wywoaływana podczas dodania nowej pozycji w bazie savingItems
  1) dodaj saving ID do odpowiedniej linii
  2) zwiększ w linii cashLeft
  4) w savings zmniejsz cashLeft (total)
  5) w odpowiedniej linii dodaj savingItem
*/

    
        if (event.data.val().initial) {
            return;
        }
    
        



    let savingsId = null;
    const savingsItemId = event.params.pushId;
    const amount = event.data.val().amount;
    //    console.log("Amount w saving item id: ", savingItemId, " = ", amount);
    const savingsLineId = event.data.val().savingsLineId;
    const root = event.data.ref.root;
    const slRef = root.child(`/savingsLines/${savingsLineId}`);
    return slRef.once('value')
        .then(snap => {
            const savingsLine = snap.val();
            savingsLine.cashLeft += amount;
            savingsId = savingsLine.savingsId;
   
            return slRef.set(savingsLine)
        })
        .catch(error => {
            console.log(error);
        });
});





/******************************************************************

                    BUDGET

 *******************************************************************/


export let addOutgo = functions.database
    .ref('/outgoes/{pushId}')
    .onCreate(event => {
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
                    (<any>Object).assign(budgetLine, { noOutgoes: 0 });
                }
                budgetLine.noOutgoes = ++budgetLine.noOutgoes;
                budgetLine.cashLeft -= amount;
                budgetId = budgetLine.budgetId;
                if (!budgetLine.hasOwnProperty('outgoes')) {
                    //jeżeli nie ma żadnego outgo to utwórz obiekt
                    //     console.log("Nie ma property outgoes!");
                    (<any>Object).assign(budgetLine, { outges: { [outgoId]: true } });
                } else {
                    //w przeciwnym wypadku dodaj tylko referencję
                    (<any>Object).assign(budgetLine.outgoes, { [outgoId]: true });
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