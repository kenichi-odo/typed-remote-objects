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
  public static Map<String, Object> createCustomObject(String object_name, Map<String, Object> fields) {
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

## When handling Attachment object

Define the overwrite method with Apex,

```java
public with sharing class ExamplePageClass {
  @RemoteAction
  public static map<string, object> retrieveAttachment(String object_name, String[] fields, Map<String,Object> criteria) {
    String[] fs = new String[0];
    for (String f : fields) {
      if (f.equals('Body')) continue;
      fs.add(f);
    }
    return RemoteObjectController.retrieve(object_name, fs, criteria);
  }

  @RemoteAction
  public static map<string, object> createAttachment(String object_name, Map<String, Object> fields) {
    return RemoteObjectController.create(
      object_name,
      new Map<String, Object>{
        'Body' => EncodingUtil.base64Decode((String) fields.get('Body')),
        'ContentType' => fields.get('ContentType'),
        'Name' => fields.get('Name'),
        'ParentId' => fields.get('ParentId')
      }
    );
  }

  @RemoteAction
  public static map<string, object> updateAttachment(String object_name, String[] record_ids, Map<String, Object> fields) {
    Attachment a = [SELECT Id, Body FROM Attachment WHERE Id = :record_ids.get(0)];

    return RemoteObjectController.updat(
      object_name,
      record_ids,
      new Map<String, Object>{
        'Body' => EncodingUtil.base64Decode(EncodingUtil.base64Encode(a.Body) + (String) fields.get('Body'))
      }
    );
  }
}
```

Please call it from Visualforce.

```html
<apex:remoteObjectModel
  name="Attachment"
  retrieve="{!$RemoteAction.ExamplePageClass.retrieveAttachment}"
  create="{!$RemoteAction.ExamplePageClass.createAttachment}"
  update="{!$RemoteAction.ExamplePageClass.updateAttachment}"
>
  <apex:remoteObjectField name="Body" /> <apex:remoteObjectField name="ContentType" />
  <apex:remoteObjectField name="Name" /> <apex:remoteObjectField name="ParentId" />
</apex:remoteObjectModel>
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
  getFormattedCreatedDate(this: SObject): string
  getText(this: SObject & Extensions): string
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
  // Retrieves
  const result1: Record<SObject, Extensions> | null = await CustomObject__c()
    .where('Id', { eq: 'salesforce_id' })
    .one() // Retrieve with `limit (1)`

  const obj = result1!.toObject() // Returns an object literal without methods or functions

  const result2: Record<SObject, Extensions>[] = await CustomObject__c()
    .where('Id', { in: ['salesforce_id_1', 'salesforce_id_2'] })
    .size(256) // If `limit()` `offset()` is not set, you can specify the number of records with `size()` (Maximum 2000)
    .all()

  const result3: Record<SObject, Extensions>[] = await CustomObject__c()
    .where('OwnerId', { eq: 'salesforce_user_id' })
    .order('CreatedDate', 'ASC')
    .order('FieldDate__c', 'DESC NULLS LAST') // Multiple orders can be specified
    .limit(5) // Maximum 100
    .offset(10) // Maximum 2000
    .all()

  const result4: Record<SObject, Extensions>[] = await CustomObject__c()
    .where('Name', { eq: 'foo' })
    .where('FieldNumber__c', { ne: 0 }) // Multiple conditions can be specified
    .all() // If `limit()` `offset()` `size()` is not set, that retrieve up to 2000 records that exist

  // AND, OR pattern
  const result5: Record<SObject, Extensions>[] = await CustomObject__c()
    .and(_ => _.where('FieldString__c', { eq: 'text' }), _ => _.where('FieldBoolean__c', { eq: false }))
    .all()

  const result6: Record<SObject, Extensions>[] = await CustomObject__c()
    .or(_ => _.where('FieldString__c', { eq: 'text' }), _ => _.where('FieldBoolean__c', { eq: false }))
    .all()

  // You can also specify conditions in the conventional format
  const co = CustomObject__c()
  co._wheres = {
    and: {
      FieldString__c: { eq: 'text' },
      FieldBoolean__c: { eq: false },
    },
  }
  const result7: Record<SObject, Extensions>[] = await co.all()

  // CUDs
  const inserted_record: Record<SObject, Extensions> = await CustomObject__c()
    .record({ FieldBoolean__c: false })
    .set('FieldString__c', 'text')
    .insert()

  const formatted_created_date = inserted_record.getFormattedCreatedDate() // formatted_created_date => YYYY-MM-DD

  const updated_record: Record<SObject, Extensions> = await inserted_record
    .set('FieldDate__c', new Date())
    .set('FieldString__c', null)
    .update()

  await updated_record.delete()

  // Custom metadata example
  const result8: Record<SObject, Extensions>[] = await CustomMetadata__mdt()
    .limit(100) // Please specify `limit` for error avoidance
    .all()
})()
```
