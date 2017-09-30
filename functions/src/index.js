"use strict";
exports.__esModule = true;
var functions = require("firebase-functions");
//version: 0.9.0
/******************************************************************

                    SAVINGS

 *******************************************************************/
exports.addSavingsLine = functions.database.ref('/savingsLines/{pushId}').onCreate(function (event) {
    /*
Funkcja wywoaływana podczas dodania nowej linii
1) dodaj linię do savings (jeżeli dodanie)
2) zwiększ w savings cash left
3) różnicę pomiędzy nową wartością linii, a wartością w savings dodaj jako savingItem
*/
    var savingsId = event.data.val().savingsId;
    var savingsLineId = event.params.pushId;
    var newAmount = event.data.val().cashLeft;
    var root = event.data.ref.root;
    var sRef = root.child("/savings/" + savingsId);
    var newSavingsItemKey = root.child("/savingsItems/").push().key;
    var siRef = root.child("/savingsItems/" + newSavingsItemKey);
    // console.log("New saving item key: ", newSavingItemKey);
    return sRef.once('value')
        .then(function (snap) {
        var savings = snap.val();
        savings.totalCash += newAmount; //dodaj różnicę
        if (!savings.hasOwnProperty('lines')) {
            //jeżeli nie ma żadnej linii to utwórz obiekt
            Object.assign(savings, { lines: (_a = {}, _a[savingsLineId] = true, _a) });
        }
        else {
            //w przeciwnym wypadku dodaj tylko referencję
            Object.assign(savings.lines, (_b = {}, _b[savingsLineId] = true, _b));
        }
        var savPromise = sRef.set(savings);
        var newSavingsItem = {};
        Object.assign(newSavingsItem, { amount: newAmount, savingsLineId: savingsLineId, initial: true });
        var siPromise = siRef.set(newSavingsItem);
        return Promise.all([savPromise, siPromise]);
        var _a, _b;
    })["catch"](function (error) {
        console.log(error);
    });
});
exports.editSavingsLine = functions.database.ref('/savingsLines/{pushId}').onUpdate(function (event) {
    /*
    Funkcja wywoaływana podczas dodania nowej lub edycji istniejącej linii
    1) dodaj linię do savings (jeżeli dodanie)
    2) zwiększ w savings cash left
    3) różnicę pomiędzy nową wartością linii, a wartością w savings dodaj jako savingItem

    
*/
    var savingsId = event.data.val().savingsId;
    var savingsLineId = event.params.pushId;
    var prevAmount = event.data.previous.val().cashLeft;
    var newAmount = event.data.val().cashLeft;
    var root = event.data.ref.root;
    var sRef = root.child("/savings/" + savingsId);
    return sRef.once('value')
        .then(function (snap) {
        var savings = snap.val();
        savings.totalCash += (newAmount - prevAmount); //dodaj różnicę
        return sRef.set(savings);
    })["catch"](function (error) {
        console.log(error);
    });
});
exports.removeSavingsLine = functions.database.ref('/savings/{pushId}/lines/{pushId2}').onDelete(function (event) {
    /*
      Funkcja wywoaływana podczas usuwania linii z savings
      1) usuń całą linię z savingLines
      2) usuń wszystkie savingItems dla savingLineId
  */
    var savingId = event.params.pushId;
    var savingLineId = event.params.pushId2;
    var root = event.data.ref.root;
    var slRef = root.child("/savingLines/" + savingLineId);
    var slCashLeft = 0;
    var savingItemIds = [];
    var promisesArray = [];
    return slRef.once('value')
        .then(function (snap) {
        var savingLine = snap.val();
        slCashLeft = savingLine.cashLeft;
        if (savingLine && savingLine.hasOwnProperty('savingItems')) {
            Object.keys(savingLine.savingItems).forEach(function (key) {
                promisesArray.push(root.child("/savingItems/" + key).remove());
                //   return root.child(`/savingItems/${key}`).remove();
            });
        }
        //     console.log("Rozmiar tabei promisesArray: ", promisesArray.length);
        promisesArray.push(slRef.remove());
        return Promise.all(promisesArray);
    })
        .then(function () {
        return root.child("/savings/" + savingId).once('value');
    })
        .then(function (snap) {
        var saving = snap.val();
        // console.log("Total cash przed redukcją: ", saving.totalCash, ", redukujemy o: ", slCashLeft);
        saving.totalCash -= slCashLeft;
        return root.child("/savings/" + savingId).set(saving);
    })["catch"](function (error) {
        console.log(error);
    });
});
exports.addSavingsItem = functions.database.ref('/savingsItems/{pushId}').onCreate(function (event) {
    /*
  Funkcja wywoaływana podczas dodania nowej pozycji w bazie savingItems
  1) dodaj saving ID do odpowiedniej linii
  2) zwiększ w linii cashLeft
  4) w savings zmniejsz cashLeft (total)
  5) w odpowiedniej linii dodaj savingItem
*/
    /*
        if (event.data.val().initial) {
            return;
        }
    
        */
    var savingsId = null;
    var savingsItemId = event.params.pushId;
    var amount = event.data.val().amount;
    //    console.log("Amount w saving item id: ", savingItemId, " = ", amount);
    var savingsLineId = event.data.val().savingsLineId;
    var root = event.data.ref.root;
    var slRef = root.child("/savingsLines/" + savingsLineId);
    return slRef.once('value')
        .then(function (snap) {
        var savingsLine = snap.val();
        savingsLine.cashLeft += amount;
        savingsId = savingsLine.savingsId;
        if (!savingsLine.hasOwnProperty('savingsItems')) {
            //jeżeli nie ma żadnego outgo to utwórz obiekt
            Object.assign(savingsLine, { savingsItems: (_a = {}, _a[savingsItemId] = true, _a) });
        }
        else {
            //w przeciwnym wypadku dodaj tylko referencję
            Object.assign(savingsLine.savingsItems, (_b = {}, _b[savingsItemId] = true, _b));
        }
        return slRef.set(savingsLine);
        var _a, _b;
    })["catch"](function (error) {
        console.log(error);
    });
});
/******************************************************************

                    BUDGET

 *******************************************************************/
exports.addOutgo = functions.database
    .ref('/outgoes/{pushId}')
    .onCreate(function (event) {
    /*
Funkcja wywoaływana podczas dodania nowej pozycji w bazie outgoes
1) dodaj outgo ID do odpowiedniej linii
2) zmniejsz w linii cashLeft
3) zwiększ w linii noOutgoes
4) w budget zmniejsz cashLeft
*/
    var budgetId = null;
    var outgoId = event.params.pushId;
    var amount = event.data.val().amount;
    var budgetLineId = event.data.val().budgetLineId;
    var root = event.data.ref.root;
    var blRef = root.child("/budgetLines/" + budgetLineId);
    return blRef.once('value')
        .then(function (snap) {
        var budgetLine = snap.val();
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
            Object.assign(budgetLine, { outges: (_a = {}, _a[outgoId] = true, _a) });
        }
        else {
            //w przeciwnym wypadku dodaj tylko referencję
            Object.assign(budgetLine.outgoes, (_b = {}, _b[outgoId] = true, _b));
        }
        //   console.log("budgetLine from Cloud Functions: ", budgetLine);
        return blRef.set(budgetLine);
        var _a, _b;
    }).then(function () {
        return root.child("/budgets/" + budgetId).once('value');
    })
        .then(function (snap) {
        var budget = snap.val();
        budget.cashLeft -= amount;
        return root.child("/budgets/" + budgetId).set(budget);
    })["catch"](function (error) {
        console.log(error);
    });
});