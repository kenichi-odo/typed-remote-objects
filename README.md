# Installation

## npm

```sh
npm i typed-remote-objects
```

## Yarn

```sh
yarn add typed-remote-objects
```

# Preparation (in Visualforce)

```
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
import { init } from 'typed-remote-objects'

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
  return init<CustomObject__c, Extensions>({
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
const CustomObject__c = () => init<CustomObject__c>({ object_name: 'CustomObject__c' })

 */
;(async () => {
  // result1 => CustomObject__c | null
  const result1 = await CustomObject__c().find('salesforce_id')

  // result2 => CustomObject__c[]
  const result2 = await CustomObject__c()
    .size(256) // If `Limit` `Offset` is not set, you can specify the number of records(Maximum 2000)
    .findAll('salesforce_id_1', 'salesforce_id_2')

  const result3 = await CustomObject__c()
    .order('CreatedDate', 'ASC')
    .order('FieldDate__c', 'DESC NULLS LAST') // Multiple orders can be specified
    .limit(5) // Maximum 100
    .offset(10) // Maximum 2000
    .findAllBy('OwnerId', { eq: 'salesforce_user_id' })

  // result4 => CustomObject__c[]
  const result4 = await CustomObject__c()
    .where('Name', { eq: 'foo' })
    .where('FieldNumber__c', { ne: 0 }) // Multiple conditions can be specified
    .all() // If `Limit` `Offset` `Size` is not set, that retrieve up to 2000 records that exist

  // inserted_record => CustomObject__c
  const inserted_record = await CustomObject__c()
    .set('FieldBoolean__c', false)
    .set('FieldString__c', 'text')
    .insert()

  // formatted_created_date => YYYY-MM-DD
  const formatted_created_date = inserted_record.getFormattedCreatedDate()

  // updated_record => CustomObject__c
  const updated_record = await inserted_record
    .set('FieldDate__c', new Date())
    .set('FieldString__c', null)
    .update()

  await updated_record.delete()
})()
```
