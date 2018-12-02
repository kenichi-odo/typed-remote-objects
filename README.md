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

## When there is no field to be set when inserting a record

Define the overwrite method with Apex,

```java
public with sharing class ExamplePageClass {
  @RemoteAction
  public static Map<String, Object> createCustomObject(String object_name_a, Map<String, Object> fields_a) {
    CustomObject__c co = new CustomObject__c();
    insert co;
    return new Map<String, Object>{ 'id' => co.Id };
  }
}
```

Please call it from Visualforce.

```
<apex:page controller="ExamplePageClass">

  <apex:remoteObjectModel name="CustomObject__c" create="{!$RemoteAction.ExamplePageClass.createCustomObject}">
    ...
  </apex:remoteObjectModel>

</apex:page>
```

# Usage

```ts
import { init, Record } from 'typed-remote-objects'

type SObject = {
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
  getFormattedCreatedDate: (this: SObject) => string
  getText(this: SObject & Extensions)
}

const CustomObject__c = () => {
  return init<SObject, Extensions>({
    object_name: 'CustomObject__c',
    time_zone_offset: 9, // In Visualforce remote objects, dates included in records are acquired in local time, but when insert and update records they are saved as UTC and differences will occur, so adjust with this property.
    extensions: {
      getFormattedCreatedDate() {
        const cd = this.CreatedDate!
        return `${cd.getFullYear()}-${cd.getMonth() + 1}-${cd.getDate()}`
      },
      getText() {
        return `${this.Name} - ${this.getFormattedCreatedDate()}`
      },
    },
  })
}

/**

// No extensions
const CustomObject__c = () => init<SObject>({ object_name: 'CustomObject__c' })

 */
;(async () => {
  const result1: Record<SObject, Extensions>[] = await CustomObject__c()
    .where('Id', { eq: 'salesforce_id' })
    .limit(1)
    .retrieve()

  const result2: Record<SObject, Extensions>[] = await CustomObject__c()
    .where('Id', { in: ['salesforce_id_1', 'salesforce_id_2'] })
    .size(256) // If `Limit` `Offset` is not set, you can specify the number of records(Maximum 2000)
    .retrieve()

  const result3: Record<SObject, Extensions>[] = await CustomObject__c()
    .where('OwnerId', { eq: 'salesforce_user_id' })
    .order('CreatedDate', 'ASC')
    .order('FieldDate__c', 'DESC NULLS LAST') // Multiple orders can be specified
    .limit(5) // Maximum 100
    .offset(10) // Maximum 2000
    .retrieve()

  const result4: Record<SObject, Extensions>[] = await CustomObject__c()
    .where('Name', { eq: 'foo' })
    .where('FieldNumber__c', { ne: 0 }) // Multiple conditions can be specified
    .retrieve() // If `Limit` `Offset` `Size` is not set, that retrieve up to 2000 records that exist

  const inserted_record: Record<SObject, Extensions> = await CustomObject__c()
    .record({ FieldBoolean__c: false })
    .set('FieldString__c', 'text')
    .insert()

  // formatted_created_date => YYYY-MM-DD
  const formatted_created_date = inserted_record.getFormattedCreatedDate()

  const updated_record: Record<SObject, Extensions> = await inserted_record
    .set('FieldDate__c', new Date())
    .set('FieldString__c', null)
    .update()

  await updated_record.delete()
})()
```
