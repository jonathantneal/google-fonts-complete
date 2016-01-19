# Google Fonts Complete

A complete list of Google Fonts and their sources.

## Usage

``` js
var fonts = require('google-fonts-complete');

console.dir(fonts);
```

yields

``` json
{
    "ABeeZee": {
        "normal:400": {
            "local": ["ABeeZee", "ABeeZee-Regular"],
            "eot":    "//fonts.gstatic.com/s/abeezee/v4/mHe7YG9wQgrkYxToGNllew.eot",
            "svg":    "//fonts.gstatic.com/l/font?kit=Q9Ho64D2EGNbyR7RUlvCNQ&skey=abecda27d5b3409a#ABeeZee",
            "ttf":    "//fonts.gstatic.com/s/abeezee/v4/JYPhMn-3Xw-JGuyB-fEdNA.ttf",
            ...
        },
        ...
    },
    ...
}
```

This list is generated from the [Google Fonts API].

## Using the generator

Use the [Google Fonts API] to create `api-response.json`.

Then, use the generator to create `google-fonts.json`.

```sh
node google-fonts-generator.js
```

[Google Fonts API]: https://developers.google.com/fonts/
