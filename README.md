# Installation

## npm

```sh
npm i typed-remote-objects
```

## Yarn

```sh
yarn add typed-remote-objects
```

# Setup

```html
<apex:page>

  <apex:remoteObjectModel name="CustomObject__c">
    <apex:remoteObjectField name="Id" />
    <apex:remoteObjectField name="Name" />
    <apex:remoteObjectField name="CreatedById" />
    <apex:remoteObjectField name="CreatedDate" />
    <apex:remoteObjectField name="LastModifiedById" />
    <apex:remoteObjectField name="LastModifiedDate" />
    <apex:remoteObjectField name="OwnerId" />
    <apex:remoteObjectField name="FieldString__c" />
    <apex:remoteObjectField name="FieldNumber__c" />
    <apex:remoteObjectField name="FieldBoolean__c" />
    <apex:remoteObjectField name="FieldDate__c" />
  </apex:remoteObjectModel>

</apex:page>
```

# Usage

```ts
import { TypedRemoteObjects } from 'typed-remote-objects'

type CustomObject__c = {
  Id?: string | null
  Name?: string | null
  CreatedById?: string | null
  CreatedDate?: Date | null
  LastModifiedById?: string | null
  LastModifiedDate?: Date | null
  OwnerId?: string | null
  FieldString__c?: string | null
  FieldNumber__c?: number | null
  FieldBoolean__c?: boolean | null
  FieldDate__c?: Date | null
}

// Extensions is optional
type Extensions = {
  getFormattedCreatedDate: (this: CustomObject__c) => string
}

const CustomObject__c = () => {
  return TypedRemoteObjects<CustomObject__c, Extensions>({
    object_name: 'CustomObject__c',
    extensions: {
      getFormattedCreatedDate() {
        const cd = this.CreatedDate!
        return `${cd.getFullYear()}-${cd.getMonth() + 1}-${cd.getDate()}`
      },
    },
  })
}

/**

// No extensions
const CustomObject__c = () => TypedRemoteObjects<CustomObject__c, Extensions>({ object_name: 'CustomObject__c' })

*/
;(async () => {
  // result1 => CustomObject__c | null
  const result1 = await CustomObject__c().Find('salesforce_id')

  // result2 => CustomObject__c[]
  const result2 = await CustomObject__c()
    .Size(256) // If "Limit" "offset" is not set, you can specify the number of records
    .FindAll('salesforce_id_1', 'salesforce_id_2')

  const result3 = await CustomObject__c()
    .Order('CreatedDate', 'ASC')
    .Order('FieldDate__c', 'DESC NULLS LAST') // Multiple orders can be specified
    .Limit(5) // Maximum 100
    .Offset(10) // Maximum 2000
    .FindAllBy('OwnerId', { eq: 'salesforce_user_id' })

  // result4 => CustomObject__c[]
  const result4 = await CustomObject__c()
    .Where('Name', { eq: 'foo' })
    .Where('FieldNumber__c', { ne: 0 }) // Multiple conditions can be specified
    .All()

  // inserted_record => CustomObject__c
  const inserted_record = await CustomObject__c()
    .Set('FieldBoolean__c', false)
    .Set('FieldString__c', 'text')
    .Insert()

  // formatted_created_date => YYYY-MM-DD
  const formatted_created_date = inserted_record.getFormattedCreatedDate()

  // updated_record => CustomObject__c
  const updated_record = await inserted_record
    .Set('FieldDate__c', new Date())
    .Set('FieldString__c', null)
    .Update()

  await updated_record.Delete()
})()
```
