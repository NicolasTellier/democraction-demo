import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('fiche bureau : résultats ministériels T1 distincts de la valeur communiquée et absence T2',async({page})=>{
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope').selectOption('bureau');
 await page.locator('#bureau-commune').selectOption('Bourg');
 await page.locator('#map-scope-value').selectOption('33067-1');
 const detail=page.locator('.map-detail .panel');
 await expect(detail).toContainText('Valeur communiquée séparément');
 await expect(detail).toContainText('875');
 const result=detail.locator('.official-bureau-result');
 await expect(result).toContainText('Législatives 2024 · 1er tour (30 juin)');
 await expect(result).toContainText('832');
 await expect(result).toContainText('530');
 await expect(result).toContainText('Edwige DIAZ');
 await expect(result).toContainText('221 voix');
 await expect(result.getByRole('link',{name:/Ministère de l’Intérieur/})).toHaveAttribute('href',/data\.gouv\.fr\/datasets/);
 await expect(result).toContainText('périmètre géographique');
 await expect(result).toContainText('scrutin non tenu');
 await page.locator('#bureau-commune').selectOption('Cavignac');
 await page.locator('#map-scope-value').selectOption('33114-2');
 const missing=page.locator('.map-detail .official-bureau-result');
 await expect(missing).toContainText('Aucun résultat officiel apparié');
 await expect(missing).toContainText('un seul bureau');
 await expect(missing.locator('.official-bureau-candidates')).toHaveCount(0);
});
