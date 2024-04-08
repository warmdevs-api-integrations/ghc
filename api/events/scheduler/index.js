const HORSES_CMS_NAME = 'Horses';
const WEBSITE_DOMAIN = 'ghc-f5749a.webflow.io';
const LIST_ID = '7f9407306d';

// authenticates you with the API standard library
// type `await lib.` to display API autocomplete
const lib = require('lib')({ token: process.env.STDLIB_SECRET_TOKEN });
const mailchimp = require('@mailchimp/mailchimp_marketing');

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: 'us14',
});

export default async function handler(request) {
  const horseCollection = await lib.webflow.collections['@1.0.0'].items.list({
    collection_id: process.env.COLLECTION_ID,
  });

  const CollectionSchema = await lib.webflow.collections['@1.0.0'].retrieve({
    collection_id: process.env.HORSES_CMS_ID,
  });

  const getOptionFieldValue = (fieldSlug, optionId) => {
    if (!CollectionSchema) return;

    const field = CollectionSchema.fields.find((field) => field.slug === fieldSlug);
    const option = field.validations.options.find((option) => option.id === optionId);
    return option?.name;
  };

  const horses = horseCollection.items;

  console.log('Running scheduled sync...');

  const addProduct = async (horseProduct) => {
    let result = null;
    try {
      result = await mailchimp.ecommerce.addStoreProduct(HORSES_CMS_ID, horseProduct);
    } catch (error) {
      console.error(error);
    }
    return result;
  };

  const updateProduct = async (horseProduct) => {
    const { id, ...rest } = horseProduct;
    console.log('REST', rest);
    let result = null;
    try {
      result = await mailchimp.ecommerce.updateStoreProduct(HORSES_CMS_ID, id, {
        ...rest,
      });
    } catch (error) {
      // product doesn't exist yet, and has to be added
      if (error.status === 404) {
        await addProduct(horseProduct);
      } else {
        console.error(error);
      }
    }
    return result;
  };

  for (let i = 0; i < horses.length; i++) {
    const horse = horses[i];
    const horseProduct = {
      id: horse._id,
      title: horse.name,
      url: `https://${WEBSITE_DOMAIN}/horses/${horse.slug}`,
      description: `
        ${horse.name} 
        
        ${horse.father} // ${horse['birth-year-2']} // ${getOptionFieldValue('sex', horse.sex)};
        
        
      
        Dressage: ${getOptionFieldValue('class-movements', horse['class-movements'])};
        Show Jumping: ${getOptionFieldValue('class-show-jumping', horse['class-show-jumping'])};
        
        ${horse.description}
      
        ${horse.height}cm / approx. ${(horse.height / 10.17).toFixed(2)}hh
        ${getOptionFieldValue('price-level', horse['price-level'])}
      `,
      image_url: horse['horse-cover-image'].url,
      height: `${horse.height}cm / ${horse.height / 10.17}hh`,
      variants: [
        {
          id: horse._id,
          title: horse.name,
          price: horse['exact-price'],
        },
      ],
    };

    const result = await updateProduct(horseProduct);
    console.log('PRODUCT', horseProduct);
    console.log('UPDATE', result);
  }

  console.log('CMS was synced succesfully!');

  return;
}
