import {CraftingApp} from './apps/CraftingApp.js';
import {RecipeSheet} from './apps/RecipeSheet.js';
import {Settings, getSystemSetting} from './Settings.js';
import {Crafting} from "./Crafting.js";
import {RecipeCompendium} from "./apps/RecipeCompendium.js";
import {AnyOfSheet} from "./apps/AnyOfSheet.js";
import {Component, Recipe} from "./Recipe.js";
import {Helper} from "./helpers/Helper.js";
import {ActorSheetTab} from "./apps/ActorSheetTab.js";

Hooks.once('init', async function () {

    async function itemTypeMigration(){
        async function addItemType(component){
            if(component.type === "Item") {
                const entity = await component.getEntity();
                component.itemType = entity.type;
            }
        }
        async function migrateRecipe(recipe){
            for(const key in recipe.attendants){
                await addItemType(recipe.attendants[key]);
            }
            for(const key in recipe.ingredients){
                await addItemType(recipe.ingredients[key]);
            }
            for(const key in recipe.results){
                await addItemType(recipe.results[key]);
            }
            await recipe.update();
        }
        ui.notifications.info("Beavers Crafting | migration: items");
        for(const recipe of game[Settings.NAMESPACE].RecipeCompendium.getAllItems()){
            await migrateRecipe(recipe);
        }
        ui.notifications.info("Beavers Crafting | migration: actors");
        for (const actor of game.actors){
            for(const recipe of game[Settings.NAMESPACE].RecipeCompendium.getForActor(actor)){
                await migrateRecipe(recipe);
            }
        }
        ui.notifications.info("Beavers Crafting | migration: done");
    }
    Settings.init();
    if(!game[Settings.NAMESPACE])game[Settings.NAMESPACE]={};
    game[Settings.NAMESPACE].Crafting = Crafting;
    game[Settings.NAMESPACE].RecipeCompendium = RecipeCompendium;
    game[Settings.NAMESPACE].Component = Component;
    game[Settings.NAMESPACE].Recipe = Recipe;
    if(game instanceof Game) {
        game[Settings.NAMESPACE].Helper = new Helper(game);
    }
    game[Settings.NAMESPACE].itemTypeMigration = itemTypeMigration;
});

Hooks.on("ready",async function () {
    const version = Settings.get(Settings.MAJOR_VERSION);
    if(!version || version<=0){
        //I created the first breaking change,while I am still in version 0 and users are informed that there might be breaking changes I ship out a migration script.
        //I think I soon should move this module out of develop phase version 0. I already start counting the internal major version.
        await game[Settings.NAMESPACE].itemTypeMigration();
    }
    Settings.set(Settings.MAJOR_VERSION,2);
});

Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
    if(Settings.get(Settings.ADD_HEADER_LINK)) {
        buttons.unshift({
            label: "beaversCrafting.actorLink",
            class: "beaversCrafting",
            icon: "fas fa-scroll",
            onclick: () => new CraftingApp(app.object).render(true)
        });
    }
});

Hooks.on("renderActorSheet", (app, html, data)=>{
    new ActorSheetTab(app, html, data);
});

//Recipe remap use action
Hooks.on(`dnd5e.preUseItem`, (item, config, options) => {
    if(item.flags[Settings.NAMESPACE]?.recipe){
        Crafting.fromOwned(item).craft();
        return false;
    }
});

//SubTypeSheet
Hooks.on(`renderItemSheet`, (app, html, data) => {
    RecipeSheet.bind(app, html, data);
    AnyOfSheet.bind(app,html,data);
});


//add Subtype to create Item
Hooks.on("preCreateItem", (doc, createData, options, user) => {
    if (createData.flags["beavers-crafting"]?.subtype === 'recipe' ) {
        doc.updateSource({"flags.beavers-crafting.subtype": Settings.RECIPE_SUBTYPE,"img":"icons/sundries/scrolls/scroll-worn-tan.webp"});
    }
    if (createData.flags["beavers-crafting"]?.subtype === 'anyOf' ) {
        doc.updateSource({"flags.beavers-crafting.subtype": Settings.ANYOF_SUBTYPE,"img":"modules/beavers-crafting/icons/anyOf.png"});
    }
});

//evil
Hooks.on("renderDialog", (app, html, content) => {
    const title = game.settings.get(Settings.NAMESPACE,Settings.CREATE_ITEM_TITLE)||"Create New Item";

    if (app.data.title === title) {
        if (html[0].localName !== "div") {
            html = $(html[0].parentElement.parentElement);
        }
        const itemType = getSystemSetting().itemType;

        html.find("select[name='type']").append("<option value='"+itemType+"'>📜Recipe📜</option>");
        html.find("select[name='type']").append("<option value='"+itemType+"'>❔AnyOf❔</option>");
        if (html.find("input.subtype").length === 0) {
            html.find("form").append('<input class="subtype" name="flags.beavers-crafting.subtype" style="display:none" value="">');
        }
        html.find("select[name='type']").on("change", function () {
            const name = $(this).find("option:selected").text();
            let value = "";
            if (name === "📜Recipe📜") {
                value = "recipe"
            }
            if (name === "❔AnyOf❔") {
                value = "anyOf"
            }
            html.find("input.subtype").val(value);
        })
    }
});

//fucking stupid handlebars !!!
Handlebars.registerHelper('hasKey', function (param1, key, options) {
    if (param1[key]) {
        return options.fn(this);
    }
    return options.inverse(this);
});